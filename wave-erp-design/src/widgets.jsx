import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './icons.jsx';

// ── Погода: WMO-код → иконка + подпись ────────────────────────────────
function wmo(code) {
  if (code === 0) return { icon: 'sun', label: 'Ясно' };
  if (code <= 2) return { icon: 'cloudsun', label: 'Малооблачно' };
  if (code === 3) return { icon: 'cloud', label: 'Облачно' };
  if (code === 45 || code === 48) return { icon: 'cloud', label: 'Туман' };
  if (code >= 95) return { icon: 'storm', label: 'Гроза' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'snow', label: 'Снег' };
  if (code >= 51) return { icon: 'rain', label: 'Дождь' };
  return { icon: 'cloudsun', label: 'Переменно' };
}

// Фолбэк, если API недоступен (июльский Ташкент)
const FALLBACK = {
  temp: 36, code: 0, hi: 38, lo: 24,
  hours: [
    { h: '14', t: 36, code: 0 }, { h: '15', t: 37, code: 0 }, { h: '16', t: 37, code: 1 },
    { h: '17', t: 36, code: 1 }, { h: '18', t: 34, code: 1 }, { h: '19', t: 32, code: 0 },
  ],
};

export function WeatherWidget() {
  const [w, setW] = useState(FALLBACK);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=41.31&longitude=69.28'
          + '&current=temperature_2m,weather_code'
          + '&hourly=temperature_2m,weather_code'
          + '&daily=temperature_2m_max,temperature_2m_min'
          + '&timezone=Asia%2FTashkent&forecast_days=2';
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) return;
        const j = await r.json();
        const nowIso = j.current.time.slice(0, 13);
        let idx = j.hourly.time.findIndex((t) => t.slice(0, 13) === nowIso);
        if (idx < 0) idx = 0;
        const hours = j.hourly.time.slice(idx + 1, idx + 7).map((t, k) => ({
          h: t.slice(11, 13),
          t: Math.round(j.hourly.temperature_2m[idx + 1 + k]),
          code: j.hourly.weather_code[idx + 1 + k],
        }));
        setW({
          temp: Math.round(j.current.temperature_2m),
          code: j.current.weather_code,
          hi: Math.round(j.daily.temperature_2m_max[0]),
          lo: Math.round(j.daily.temperature_2m_min[0]),
          hours,
        });
      } catch { /* остаёмся на фолбэке */ }
    })();
    return () => ctrl.abort();
  }, []);

  const cur = wmo(w.code);
  return (
    <div className="weather-body">
      <div className="weather-top">
        <div>
          <div className="weather-city">Ташкент</div>
          <div className="weather-temp">{w.temp}°</div>
          <div className="weather-cond">{cur.label} · Д:{w.hi}° Н:{w.lo}°</div>
        </div>
        <motion.span
          className="weather-big-icon"
          animate={{ y: [0, -5, 0], rotate: [0, 3, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon name={cur.icon} size={54} strokeWidth={1.4} />
        </motion.span>
      </div>
      <div className="weather-hours">
        {w.hours.map((h, i) => (
          <motion.div
            className="wh" key={h.h + i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.06, duration: 0.4 }}
          >
            <span className="wh-h">{h.h}</span>
            <Icon name={wmo(h.code).icon} size={16} />
            <span className="wh-t">{h.t}°</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Календарь: события дня + мини-месяц ───────────────────────────────
const EVENTS = [
  { time: '09:00', title: 'Планёрка директоров', color: '#0A84FF' },
  { time: '12:30', title: 'Платёж «Karvon Textile» · $4,200', color: '#FF3B30' },
  { time: '15:00', title: 'Инвентаризация · Чиланзар', color: '#FF9F0A' },
  { time: '18:00', title: 'Итоги дня · отчёт BHI', color: '#BF5AF2' },
];
const WD = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function CalendarWidget() {
  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const y = now.getFullYear(), m = now.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Пн=0
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  return (
    <div className="cal-body">
      <div className="cal-date">
        <div className="cal-wd">{weekday}</div>
        <motion.div
          className="cal-num"
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.15 }}
        >
          {day}
        </motion.div>
        <div className="cal-month">{MONTHS_RU[m]}</div>
      </div>

      <div className="cal-events">
        {EVENTS.map((e, i) => (
          <motion.div
            className="cal-ev" key={e.title}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.07, duration: 0.35 }}
          >
            <span className="cal-ev-bar" style={{ background: e.color }} />
            <div style={{ minWidth: 0 }}>
              <div className="cal-ev-title">{e.title}</div>
              <div className="cal-ev-time">{e.time}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="cal-month-grid">
        {WD.map((d, i) => <span key={'h' + i} className="cal-cell cal-head">{d}</span>)}
        {cells.map((d, i) => (
          <span key={i} className={`cal-cell${d === day ? ' today' : ''}`}>{d || ''}</span>
        ))}
      </div>
    </div>
  );
}
