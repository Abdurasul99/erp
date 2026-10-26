// Язык экранов «Декора» (RU по умолчанию, UZ — латиница) и форматы денег и дат.
// Выбор запоминается на устройстве (localStorage 'decor_lang'), отдельно от языка Wave и учебного центра.
import { useCallback, useSyncExternalStore } from 'react';
import { TEXTS } from './texts.js';

const KEY = 'decor_lang';
let current = (() => { try { return localStorage.getItem(KEY) === 'uz' ? 'uz' : 'ru'; } catch { return 'ru'; } })();
const listeners = new Set();
export function setLang(l) {
  current = l === 'uz' ? 'uz' : 'ru';
  try { localStorage.setItem(KEY, current); } catch { /* хранилище недоступно */ }
  try { document.documentElement.lang = current; } catch { /* нет документа */ }
  listeners.forEach(f => f());
}
const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : s);
export function tr(lang, key, vars) { return fill(TEXTS[lang][key] ?? TEXTS.ru[key] ?? key, vars); }

export function useT() {
  const lang = useSyncExternalStore(subscribe, () => current, () => current);
  const t = useCallback((key, vars) => tr(lang, key, vars), [lang]);
  return { t, lang, setLang };
}

// ---------- Форматы ----------
const group = n => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// $1 450 / −$229 — целые доллары; fm2 — с центами
export const fm = n => `${n < 0 ? '−' : ''}$${group(n)}`;
export const fm2 = n => {
  const a = Math.abs(n || 0); const cents = Math.round(a * 100) % 100;
  return `${n < 0 ? '−' : ''}$${group(Math.floor(Math.round(a * 100) / 100))}.${String(cents).padStart(2, '0')}`;
};
export const fsum = (n, lang) => `${group(n)} ${lang === 'uz' ? 'so‘m' : 'сум'}`;

const MONTHS = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
};
const MONTHS_FULL = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
};
const WEEK = { ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], uz: ['yak', 'dush', 'sesh', 'chor', 'pay', 'jum', 'shan'] };
const WEEK_FULL = {
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
};
const parts = ymd => { const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number); return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
// «25 окт, сб» / «25-okt, shan»
export const fday = (ymd, lang) => { if (!ymd) return '—'; const p = parts(ymd); return lang === 'uz' ? `${p.d}-${MONTHS.uz[p.m - 1]}, ${WEEK.uz[p.w]}` : `${p.d} ${MONTHS.ru[p.m - 1]}, ${WEEK.ru[p.w]}`; };
// «25 окт» / «25-okt»
export const fdm = (ymd, lang) => { if (!ymd) return '—'; const p = parts(ymd); return lang === 'uz' ? `${p.d}-${MONTHS.uz[p.m - 1]}` : `${p.d} ${MONTHS.ru[p.m - 1]}`; };
// «25.10»
export const fdd = ymd => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '—');
// Сегодня длинно: «суббота, 24 октября»
export const ftoday = (ymd, lang) => { const p = parts(ymd); return lang === 'uz' ? `${WEEK_FULL.uz[p.w]}, ${p.d}-${MONTHS_FULL.uz[p.m - 1]}` : `${WEEK_FULL.ru[p.w]}, ${p.d} ${MONTHS_FULL.ru[p.m - 1]}`; };
// Период брони: «25–26 окт»
export const fperiod = (p, lang) => (!p ? '—' : p.from === p.to ? fdm(p.from, lang) : `${fdm(p.from, lang)} – ${fdm(p.to, lang)}`);
const MONTHS_NOM = {
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
};
// «октябрь 2026» / «oktabr 2026» — для фильтра по месяцу
export const fmonth = (ym, lang) => { const [y, m] = String(ym).split('-').map(Number); return `${MONTHS_NOM[lang][m - 1]} ${y}`; };
// Дата из отметки времени сервера (ISO) — по часам устройства
export const fts = (ts, lang) => (ts ? fday(localYmd(new Date(ts)), lang) : '—');
export const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
