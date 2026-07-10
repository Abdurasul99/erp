// Консьюмер: подписывается на sim/+/+/+, каждое сообщение = полностью готовая операция
// { c, type, method, path, token, body }. Выполняет реальный API-вызов с ограничением
// конкурентности. Рост внутренней очереди = backpressure (сервер/БД не успевают).
const mqtt = require('mqtt');
const cfg = require('./config');
const { api } = require('./wareapp');
const metrics = require('./metrics');

const QUEUE_CAP = 20000; // защита от OOM при насыщении; превышение считаем как drop

function classifyError(status, raw) {
  if (status === 0) return 'conn/timeout';
  if (status === 429) return '429';
  if (status === 400 && /остат|сток|stock|недостаточ|insufficient/i.test(raw || '')) return 'insufficient_stock';
  return String(status);
}

function startConsumer() {
  const client = mqtt.connect(`mqtt://127.0.0.1:${cfg.mqttPort}`, { clientId: 'sim-consumer', clean: true });
  const queue = [];
  let inflight = 0;

  // Выполнить операцию. Для продажи при insufficient_stock — САМОВОССТАНОВЛЕНИЕ:
  // докидываем большой сток в тот же филиал (тем же warehouse-токеном) и повторяем продажу.
  // Так каждая «непросеянная» комбинация товар×филиал чинится при первом касании → ошибки → 0.
  const exec = async (op) => {
    const r = await api(op.method, op.path, op.token, op.body);
    const okk = r.status >= 200 && r.status < 300;
    if (!okk && op.type === 'sale' && !op._healed && classifyError(r.status, r.raw) === 'insufficient_stock') {
      op._healed = true;
      metrics.errors['restock_heal'] = (metrics.errors['restock_heal'] || 0) + 1;
      await api('POST', '/stock/income', op.token, {
        product_id: op.body.product_id, quantity: 1000000, price: 0, // price:0 — не трогаем price_buy товара
        payment_status: 'paid', payment_method: 'cash', note: '[SIM] heal',
      });
      const r2 = await api(op.method, op.path, op.token, op.body);
      const ok2 = r2.status >= 200 && r2.status < 300;
      metrics.onResult(op.c, op.type, r2.status, r2.ms, ok2 ? null : classifyError(r2.status, r2.raw));
      return;
    }
    metrics.onResult(op.c, op.type, r.status, r.ms, okk ? null : classifyError(r.status, r.raw));
  };

  const pump = () => {
    while (inflight < cfg.concurrency && queue.length) {
      const op = queue.shift();
      metrics.queue = queue.length;
      inflight++;
      metrics.inflight = inflight;
      exec(op)
        .catch(() => metrics.onResult(op.c, op.type, 0, 0, 'exception'))
        .finally(() => { inflight--; metrics.inflight = inflight; pump(); });
    }
  };

  client.on('connect', () => {
    client.subscribe('sim/+/+/+', { qos: 0 }, (err) => {
      if (err) console.error('[consumer] subscribe error', err.message);
      else console.log('[consumer] subscribed sim/+/+/+ (concurrency', cfg.concurrency + ')');
    });
  });

  client.on('message', (_topic, buf) => {
    metrics.onConsume();
    if (queue.length >= QUEUE_CAP) {
      metrics.errors['backpressure_drop'] = (metrics.errors['backpressure_drop'] || 0) + 1;
      return; // сервер/БД захлёбываются — фиксируем потолок, не растим память
    }
    let op;
    try { op = JSON.parse(buf.toString()); } catch { return; }
    if (!op || !op.path) return;
    queue.push(op);
    metrics.queue = queue.length;
    pump();
  });

  client.on('error', (e) => console.error('[consumer] mqtt error', e.message));
  return { client, stats: () => ({ inflight, queued: queue.length }) };
}

module.exports = { startConsumer };
