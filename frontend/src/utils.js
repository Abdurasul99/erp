import { useState, useCallback } from 'react';

// Auto-dismiss message hook (3 sec)
export function useMsg() {
  const [msg, setMsgState] = useState(null);
  const setMsg = useCallback((type, text) => {
    setMsgState({ type, text });
    if (type === 'success') setTimeout(() => setMsgState(null), 3000);
  }, []);
  const clearMsg = useCallback(() => setMsgState(null), []);
  return [msg, setMsg, clearMsg];
}

// Format money with space-separated thousands (UZ/RU style) + UZS suffix.
// E.g. fmtMoney(32952481) → "32 952 481 UZS"
export function fmtMoney(v) {
  const n = Math.round(parseFloat(v) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' UZS';
}

// Number with space separators, no currency suffix.
// E.g. fmtNum(32952481) → "32 952 481"
export function fmtNum(v) {
  const n = parseFloat(v) || 0;
  // Preserve up to 3 decimal places for quantities, but trim trailing zeros
  const rounded = Math.round(n * 1000) / 1000;
  const [intPart, decPart] = rounded.toString().split('.');
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (decPart ? '.' + decPart : '');
}

// All formatters use the BROWSER's local timezone so users in different
// regions see times relative to where they are. Server stores moments-in-time;
// browser renders them in its own TZ via Intl.

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru');
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Short "DD.MM HH:mm" used on compact sale cards
export function formatDateTimeShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('ru', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// Given a period key ('today'|'week'|'month'|'year'|'custom') and optional {from, to} YYYY-MM-DD strings,
// returns [Date|null, Date|null] inclusive bounds. Null bounds = no limit on that side ("all").
export function periodRange(period, customRange = {}) {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  if (period === 'today') return [startOfDay(now), endOfDay(now)];
  if (period === 'week')  { const w = new Date(now); w.setDate(w.getDate()-6);   return [startOfDay(w), endOfDay(now)]; }
  if (period === 'month') { const m = new Date(now); m.setDate(m.getDate()-29);  return [startOfDay(m), endOfDay(now)]; }
  if (period === 'year')  { const y = new Date(now); y.setDate(y.getDate()-364); return [startOfDay(y), endOfDay(now)]; }
  if (period === 'custom' && (customRange.from || customRange.to)) {
    const from = customRange.from ? startOfDay(new Date(customRange.from)) : null;
    const to   = customRange.to   ? endOfDay(new Date(customRange.to))     : null;
    return [from, to];
  }
  return [null, null]; // 'all'
}

// Filter array of records (with .created_at) by a period range
export function filterByPeriod(items, period, customRange) {
  const [from, to] = periodRange(period, customRange);
  if (!from && !to) return items;
  return items.filter(i => {
    const d = new Date(i.created_at);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

// Human-friendly "time since" — needs t() for i18n labels
export function formatLastLogin(dateStr, t) {
  if (!dateStr) return { text: t('neverLoggedIn'), color: '#9EA3BF', recent: false };
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60)       return { text: t('justNow'),                    color: '#16a34a', recent: true };
  if (min < 5)        return { text: t('online'),                     color: '#16a34a', recent: true };
  if (min < 60)       return { text: `${min} ${t('minutesAgo')}`,     color: '#4338ca', recent: false };
  if (hr  < 24)       return { text: `${hr} ${t('hoursAgo')}`,        color: '#4338ca', recent: false };
  if (day < 7)        return { text: `${day} ${t('daysAgo')}`,        color: '#6B6F8A', recent: false };
  return { text: formatDateTime(dateStr),                             color: '#9EA3BF', recent: false };
}
