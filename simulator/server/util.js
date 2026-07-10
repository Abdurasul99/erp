// Мелкие хелперы (паттерны из seed_demo.js + ограничитель конкурентности).
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Параллельная обработка с ограничением конкурентности (для разовой провизии).
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Короткий уникальный суффикс (без Date.now в чистом виде — но тут можно, не workflow).
function shortId() {
  return Math.random().toString(36).slice(2, 7) + Math.floor(Math.random() * 1e4).toString(36);
}

module.exports = { rnd, rndInt, chance, pick, sleep, pmap, shortId };
