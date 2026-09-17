'use strict';

// Buffer the bounded response before releasing the timeout/concurrency slot:
// a provider that sends headers but stalls its body must also be cancelled.
// Когда имеет смысл взять следующую модель из списка.
//   404 / model_not_found — модель снята провайдером навсегда (так Groq убрал
//     llama-3.3-70b-versatile 16.08.2026 и весь ИИ в продукте замолчал);
//   502 / 503 / temporarily unavailable — модель жива, но сейчас не отвечает.
// Второй случай раньше не покрывался, и пользователь видел «Upstream AI error
// 503» при живых соседних моделях: на проде gpt-5.5 отдавала 503 два раза из
// трёх, тогда как gpt-6-astra и gemini-3.8-flash отвечали 200 подряд.
// Осознанно НЕ перебираем на 401 (плохой ключ — упадут все) и на 429 (лимит:
// перебор моделей только умножит нагрузку).
function shouldTryNextModel(status, text) {
  return modelGone(status, text) || transient(status, text);
}

// Модель снята провайдером навсегда — повторять её бессмысленно, только менять.
// Так Groq убрал llama-3.3-70b-versatile 16.08.2026, и весь ИИ в продукте замолчал.
const modelGone = (status, text) =>
  status === 404 || /model_not_found|decommissioned|has been deprecated/i.test(text || '');

// Модель жива, но сейчас не отвечает. Замер на проде (clodex.xyz): 8 запросов из
// 10 проходят сразу, а ОБА сбоя вылечились второй попыткой — один повтором той
// же модели, другой переключением. То есть 503 здесь случайны, и повтор спасает.
const transient = (status, text) =>
  status === 502 || status === 503 || /temporarily unavailable|upstream_unavailable/i.test(text || '');

function createAiClient({ model, fallbacks = [], timeoutMs = 30000, maxConcurrent = 4,
  maxResponseBytes = 2 * 1024 * 1024, fetchImpl = fetch }) {
  let active = 0;
  let currentModel = model;
  const unavailable = (message, status) => Object.assign(new Error(message), { statusCode: status });
  async function request(url, init) {
    if (active >= maxConcurrent) throw unavailable('AI busy', 503);
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Основную модель пробуем ДВАЖДЫ перед переходом на запасные: её выбрал
      // владелец, и при случайном 503 вторая попытка обычно проходит — менять
      // модель из-за одной осечки значит без нужды ухудшать качество ответа.
      const candidates = [currentModel, currentModel, ...fallbacks.filter(m => m !== currentModel)];
      let firstFailure;
      let retired = null;               // модель, которой у провайдера больше нет
      for (const candidate of candidates) {
        if (candidate === retired) continue;   // снятую модель второй раз не дёргаем
        const body = JSON.stringify({ ...JSON.parse(init.body), model: candidate });
        const response = await fetchImpl(url, { ...init, body, signal: controller.signal });
        const chunks = [];
        let size = 0;
        if (response.body) {
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
        }
        const text = Buffer.concat(chunks).toString('utf8');
        const buffered = new Response(response.status === 204 ? null : text,
          { status: response.status, headers: response.headers });
        if (response.ok) { currentModel = candidate; return buffered; }
        firstFailure ||= buffered;
        if (modelGone(response.status, text)) retired = candidate;
        if (!shouldTryNextModel(response.status, text)) return buffered;
      }
      return firstFailure;
    } catch (error) {
      if (controller.signal.aborted) throw unavailable('AI timeout', 504);
      throw error;
    } finally {
      clearTimeout(timer);
      active--;
    }
  }
  return { request, model: () => currentModel };
}

module.exports = { createAiClient };
