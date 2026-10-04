'use strict';

// Когда имеет смысл взять следующую модель из списка.
//   404 / model_not_found — модель снята провайдером навсегда (так Groq убрал
//     llama-3.3-70b-versatile 16.08.2026 и весь ИИ в продукте замолчал);
//   502 / 503 / temporarily unavailable — модель жива, но сейчас не отвечает.
// Второй случай раньше не покрывался, и пользователь видел «Upstream AI error
// 503» при живых соседних моделях.
// Осознанно НЕ перебираем на 401 (плохой ключ — упадут все) и на 429 (лимит:
// перебор моделей только умножит нагрузку).
function shouldTryNextModel(status, text) {
  if (status === 401 || status === 403 || status === 429) return false;
  return modelGone(status, text) || transient(status, text);
}

// Модель снята провайдером навсегда — повторять её бессмысленно, только менять.
const modelGone = (status, text) =>
  status === 404 || /model_not_found|decommissioned|has been deprecated/i.test(text || '');

// Модель жива, но сейчас не отвечает. Замер на проде (clodex.xyz): 8 запросов из
// 10 проходят сразу, а ОБА сбоя вылечились второй попыткой — один повтором той
// же модели, другой переключением. То есть 503 здесь случайны, и повтор спасает.
const transient = (status, text) =>
  status === 502 || status === 503 || /temporarily unavailable|upstream_unavailable/i.test(text || '');

function createAiClient({ model, fallbacks = [], timeoutMs = 45000, attemptTimeoutMs = 20000,
  maxConcurrent = 4, maxResponseBytes = 2 * 1024 * 1024, fetchImpl = fetch }) {
  let active = 0;
  let currentModel = model;
  const unavailable = (message, status) => Object.assign(new Error(message), { statusCode: status });

  // Тело читаем целиком и с ограничением размера: провайдер, который отдал
  // заголовки и завис на теле, должен быть оборван так же, как и молчащий.
  async function readBounded(response) {
    if (!response.body) return '';
    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxResponseBytes) {
          await reader.cancel();
          throw unavailable('AI response too large', 502);
        }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks).toString('utf8');
  }

  async function request(url, init) {
    if (active >= maxConcurrent) throw unavailable('AI busy', 503);
    active++;
    // Два разных ограничения вместо одного общего. Раньше единственный таймер на
    // весь вызов покрывал ВСЕ попытки сразу: сработав посреди перебора, он ронял
    // запрос с «AI timeout» даже тогда, когда следующая модель ответила бы за
    // пару секунд. Теперь у каждой попытки свой предел, а общий бюджет просто
    // не даёт перебору тянуться бесконечно (замер на проде: ответ 1.2–5.9 с).
    const deadline = Date.now() + timeoutMs;
    try {
      // Основную модель пробуем ДВАЖДЫ перед переходом на запасные: её выбрал
      // владелец, и при случайном 503 вторая попытка обычно проходит — менять
      // модель из-за одной осечки значит без нужды ухудшать качество ответа.
      const candidates = [currentModel, currentModel, ...fallbacks.filter(m => m !== currentModel)];
      let firstFailure;
      let retired = null;               // модель, которой у провайдера больше нет

      for (const candidate of candidates) {
        if (candidate === retired) continue;   // снятую модель второй раз не дёргаем
        const left = deadline - Date.now();
        if (left <= 0) break;                  // общий бюджет исчерпан
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(attemptTimeoutMs, left));
        try {
          const body = JSON.stringify({ ...JSON.parse(init.body), model: candidate });
          const response = await fetchImpl(url, { ...init, body, signal: controller.signal });
          const text = await readBounded(response);
          const buffered = new Response(response.status === 204 ? null : text,
            { status: response.status, headers: response.headers });
          if (response.ok) { currentModel = candidate; return buffered; }
          firstFailure ||= buffered;
          if (modelGone(response.status, text)) retired = candidate;
          if (!shouldTryNextModel(response.status, text)) return buffered;
        } catch (error) {
          // Зависшая попытка — не приговор всему запросу: уступаем место следующей
          // модели. Любую другую ошибку отдаём наверх как есть, чтобы не прятать
          // настоящую поломку за видимостью перебора.
          if (!controller.signal.aborted) throw error;
        } finally {
          clearTimeout(timer);
        }
      }

      if (firstFailure) return firstFailure;
      throw unavailable('AI timeout', 504);
    } finally {
      active--;
    }
  }

  return { request, model: () => currentModel };
}

module.exports = { createAiClient };
