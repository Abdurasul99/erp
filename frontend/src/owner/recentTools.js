// Недавно открытые инструменты — личная история пользователя в этом браузере.
// Нужна для баннера раздела: вместо пустого места показываем «Недавнее», чтобы
// вернуться в то, с чем человек работал, одним кликом, а не через сетку карточек.
//
// Храним локально: это личная привычка, не данные компании — на сервере ей делать
// нечего. Ключ привязан к пользователю, иначе на общем компьютере кассир видел бы
// историю учредителя.
const LIMIT = 24;

const key = (userId) => 'wave_recent_tools_' + (userId || 'anon');

export function loadRecent(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => x && x.section && x.tool) : [];
  } catch { return []; }
}

// Кладём инструмент в начало, дубли убираем — список остаётся историей визитов,
// а не журналом.
export function pushRecent(userId, section, tool) {
  if (!section || !tool) return;
  try {
    const list = loadRecent(userId).filter(x => !(x.section === section && x.tool === tool));
    list.unshift({ section, tool, at: Date.now() });
    localStorage.setItem(key(userId), JSON.stringify(list.slice(0, LIMIT)));
  } catch {}
}

// Недавние ИМЕННО этого раздела: в баннере раздела чужие инструменты не к месту.
export function recentInSection(userId, section, allowedIds, max = 3) {
  const allow = allowedIds ? new Set(allowedIds) : null;
  const out = [];
  for (const r of loadRecent(userId)) {
    if (r.section !== section) continue;
    if (allow && !allow.has(r.tool)) continue;   // инструмент могли отключить
    if (out.some(x => x.tool === r.tool)) continue;
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
