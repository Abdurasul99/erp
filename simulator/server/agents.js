// Агенты-публикаторы: тик-луп публикует реалистичные операции в MQTT с заданным темпом.
// Бизнес-цикл: продажа (основной поток) + периодический приход (поддержка остатков) + касса.
// state = { companies: Map<id,company>, running: Set<id>, rate: msg/s, realism: bool }.
const mqtt = require('mqtt');
const cfg = require('./config');
const metrics = require('./metrics');
const { rndInt, rnd, pick, chance } = require('./util');

const TICK_MS = 25; // 40 тиков/с — гладкая раздача темпа

const PAY = ['cash', 'cash', 'cash', 'card', 'card', 'transfer']; // веса способов оплаты

// Построить одну операцию для случайной запущенной компании/филиала.
function buildOp(company) {
  const br = pick(company.branches);
  const wTok = pick(br.warehouses).token;     // warehouse = trusted → продажа авто-одобряется
  const product = pick(company.products);
  const roll = Math.random();

  if (roll < 0.80) {
    // ПРОДАЖА (основной поток). warehouse-токен → approved → списывает сток + cash_income.
    const qty = rndInt(1, 3);
    const customer_id = (chance(0.8) && company.customers.length) ? pick(company.customers) : undefined;
    return {
      c: company.id, type: 'sale', method: 'POST', path: '/stock/outcome', token: wTok,
      topic: `sim/${company.id}/${br.id}/sale`,
      body: { product_id: product.id, quantity: qty, price: product.price_sell, payment_method: pick(PAY), payment_status: 'paid', customer_id },
    };
  } else if (roll < 0.90) {
    // КАССА (доход/расход) — кассир.
    const cTok = pick(br.cashiers).token;
    const isIncome = chance(0.5);
    return {
      c: company.id, type: 'cash', method: 'POST', path: isIncome ? '/cash/income' : '/cash/expense', token: cTok,
      topic: `sim/${company.id}/${br.id}/cash`,
      body: { amount: Math.round(rnd(20000, 800000) / 1000) * 1000, description: `${cfg.simTag} ${isIncome ? 'доход' : 'расход'}`, payment_method: 'cash' },
    };
  } else {
    // ПРИХОД (поддержка остатков) — складовщик.
    return {
      c: company.id, type: 'income', method: 'POST', path: '/stock/income', token: wTok,
      topic: `sim/${company.id}/${br.id}/income`,
      body: { product_id: product.id, quantity: rndInt(10, 50), price: product.price_buy, payment_status: 'paid', payment_method: 'cash', note: `${cfg.simTag} restock` },
    };
  }
}

function startAgents(state) {
  const client = mqtt.connect(`mqtt://127.0.0.1:${cfg.mqttPort}`, { clientId: 'sim-publisher', clean: true });
  let timer = null;
  let carry = 0; // накопленный дробный остаток сообщений между тиками

  const tick = () => {
    const running = [...state.running].map((id) => state.companies.get(id)).filter((c) => c && c.branches && c.branches.length);
    if (!running.length || state.rate <= 0) { carry = 0; return; }
    carry += (state.rate * TICK_MS) / 1000;
    let n = Math.floor(carry);
    carry -= n;
    while (n-- > 0) {
      const company = pick(running);
      const op = buildOp(company);
      client.publish(op.topic, JSON.stringify(op), { qos: 0 });
      metrics.onPublish();
    }
  };

  client.on('connect', () => {
    console.log('[agents] publisher connected');
    if (!timer) timer = setInterval(tick, TICK_MS);
  });
  client.on('error', (e) => console.error('[agents] mqtt error', e.message));

  return {
    client,
    stop() { if (timer) { clearInterval(timer); timer = null; } },
  };
}

module.exports = { startAgents };
