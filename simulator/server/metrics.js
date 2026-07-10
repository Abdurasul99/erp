// Сбор метрик пропускной способности и латентности (глобально + по компаниям).
// Каждую секунду index.js берёт snapshot() и публикует его в MQTT-топик sim/stats.

const N = 2048; // размер кольца латентностей для перцентилей

class Metrics {
  constructor() {
    this.reset();
  }
  reset() {
    this.published = 0;     // всего опубликовано в MQTT
    this.consumed = 0;      // всего обработано консьюмером (получено из MQTT)
    this.ok = 0;            // успешных API-операций (2xx)
    this.fail = 0;          // неуспешных (4xx/5xx/0)
    this.inflight = 0;      // сейчас в полёте к API
    this.queue = 0;         // глубина внутренней очереди консьюмера (backpressure)
    this._lat = new Float64Array(N);
    this._latIdx = 0;
    this._latCount = 0;
    this.errors = {};       // тип ошибки -> count (напр. "400", "429", "500", "0", "insufficient")
    this.perCompany = {};   // companyId -> { ok, fail, byType:{sale,income,cash} }
    // окно за последнюю секунду (заполняется в snapshot)
    this._prev = { published: 0, consumed: 0, ok: 0, fail: 0, t: Date.now() };
  }

  onPublish(n = 1) { this.published += n; }
  onConsume(companyId) { this.consumed++; }

  onResult(companyId, type, status, ms, errKey) {
    const okk = status >= 200 && status < 300;
    if (okk) this.ok++; else this.fail++;
    // латентность
    this._lat[this._latIdx] = ms;
    this._latIdx = (this._latIdx + 1) % N;
    if (this._latCount < N) this._latCount++;
    // ошибки
    if (!okk) {
      const key = errKey || String(status);
      this.errors[key] = (this.errors[key] || 0) + 1;
    }
    // по компании
    const c = (this.perCompany[companyId] = this.perCompany[companyId] || { ok: 0, fail: 0, byType: {} });
    if (okk) c.ok++; else c.fail++;
    c.byType[type] = (c.byType[type] || 0) + 1;
  }

  _percentiles() {
    const cnt = this._latCount;
    if (!cnt) return { p50: 0, p95: 0, p99: 0, max: 0 };
    const arr = Array.from(this._lat.subarray(0, cnt)).sort((a, b) => a - b);
    const at = (p) => arr[Math.min(cnt - 1, Math.floor(p * cnt))];
    return { p50: Math.round(at(0.5)), p95: Math.round(at(0.95)), p99: Math.round(at(0.99)), max: Math.round(arr[cnt - 1]) };
  }

  // Снимок: абсолютные счётчики + скорости за прошедшую секунду.
  snapshot() {
    const now = Date.now();
    const dt = Math.max(1, (now - this._prev.t)) / 1000;
    const rate = {
      published: Math.round((this.published - this._prev.published) / dt),
      consumed: Math.round((this.consumed - this._prev.consumed) / dt),
      ok: Math.round((this.ok - this._prev.ok) / dt),
      fail: Math.round((this.fail - this._prev.fail) / dt),
    };
    this._prev = { published: this.published, consumed: this.consumed, ok: this.ok, fail: this.fail, t: now };
    return {
      ts: now,
      totals: { published: this.published, consumed: this.consumed, ok: this.ok, fail: this.fail },
      rate,                       // в секунду
      inflight: this.inflight,
      queue: this.queue,
      latency: this._percentiles(),
      errors: { ...this.errors },
      perCompany: JSON.parse(JSON.stringify(this.perCompany)),
    };
  }
}

module.exports = new Metrics();
