'use strict';

// Coalesce concurrent work within one API process. PostgreSQL remains the
// source of truth; only explicit TTL callers retain completed small results.
function createRecomputeGate({ maxEntries = 2000, now = Date.now } = {}) {
  const pending = new Map();
  const completed = new Map();
  function run(key, work, ttlMs = 0) {
    if (pending.has(key)) return pending.get(key);
    const cached = completed.get(key);
    if (cached && now() < cached.until) return Promise.resolve(cached.value);
    completed.delete(key);
    if (pending.size >= maxEntries) {
      return Promise.reject(Object.assign(new Error('Analytics busy'), { statusCode: 503 }));
    }
    const promise = Promise.resolve().then(work).then(value => {
      if (ttlMs > 0) {
        for (const [entry, result] of completed) {
          if (now() >= result.until) completed.delete(entry);
        }
        while (completed.size >= maxEntries) completed.delete(completed.keys().next().value);
        completed.set(key, { value, until: now() + ttlMs });
      }
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  return { run };
}

module.exports = { createRecomputeGate };
