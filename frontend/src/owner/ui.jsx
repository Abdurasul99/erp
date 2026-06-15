import React from 'react';
import { useTt } from './tt.js';

// UI primitives — class names match the prototype's so the 47 copied tools render correctly.
// All styles are scoped via .owner-shell in owner/styles.css, so they only apply inside the shell.

export function Tile({ icon, label, value, sub, delta, color = '#5B4FE8' }) {
  const { tt } = useTt();
  return (
    <div className="tile" style={{ borderLeftColor: color }}>
      <div className="tile-label">{icon} {label}</div>
      <div className="tile-value" style={{ color }}>{value}</div>
      {delta != null && (
        <div className={'tile-delta ' + (delta >= 0 ? 'up' : 'down')}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}% {tt('к прошлому периоду')}
        </div>
      )}
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function Card({ icon, title, actions, children, style }) {
  return (
    <div className="card" style={style}>
      {(title || actions) && (
        <div className="card-header">
          {icon && <span className="card-header-icon">{icon}</span>}
          {title && <span>{title}</span>}
          {actions && <div className="card-header-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ tone = 'blue', children }) {
  return <span className={'badge badge-' + tone}>{children}</span>;
}

export function Bars({ data, max, color = '#5B4FE8' }) {
  const cap = max || Math.max(...data, 1);
  return (
    <div className="bars">
      {data.map((v, i) => (
        <div key={i} className="bar"
          style={{ height: `${(v / cap) * 100}%`, background: `linear-gradient(180deg, ${color}, ${shade(color, -20)})` }}
          title={String(v)} />
      ))}
    </div>
  );
}

// AreaChart — line with gradient fill below.  Supports an optional comparison series.
// Used on the dashboard for "Продажи за период" + "Сравнение с прошлым".
// Поддерживает читаемые оси: yAxis=true рисует 3 метки слева (max / mid / 0).
export function AreaChart({ data, prevData, color = '#5B4FE8', prevColor = '#9094B0', height = 160, labels = null, yAxis = true }) {
  const { tt } = useTt();
  if (!data || data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных за период')}</div>;
  }
  // Combined max for shared Y-scale
  const allValues = [...data, ...(prevData || [])];
  const max = Math.max(...allValues, 1);
  const mid = max / 2;
  const W = 100, H = 50;

  const polyPath = (xs, useFill) => {
    if (!xs || xs.length === 0) return '';
    if (xs.length === 1) {
      const y = H - (xs[0] / max) * (H - 8) - 4;
      return useFill
        ? `M 0,${H} L 0,${y} L ${W},${y} L ${W},${H} Z`
        : `M 0,${y} L ${W},${y}`;
    }
    const pts = xs.map((v, i) => {
      const x = (i / (xs.length - 1)) * W;
      const y = H - (v / max) * (H - 8) - 4;
      return { x, y };
    });
    const linePath = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');
    if (!useFill) return linePath;
    return `${linePath} L ${W},${H} L 0,${H} Z`;
  };

  const gradId = 'area-grad-' + Math.random().toString(36).slice(2, 8);
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {yAxis && (
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          paddingTop: 2,
          // Reserve space for the x-labels row only when labels are actually rendered,
          // otherwise the Y-axis ticks would float above the chart bottom.
          paddingBottom: (labels && labels.length > 0) ? 22 : 2,
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text3)', fontWeight: 700, minWidth: 36, textAlign: 'right',
          height,
        }}>
          <span>{fmtAxis(max)}</span>
          <span>{fmtAxis(mid)}</span>
          <span>0</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Gridlines — 0, mid, max */}
          <line x1="0" y1={H - 4} x2={W} y2={H - 4} stroke="var(--border, #e6e8f2)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--border, #e6e8f2)" strokeWidth="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={4} x2={W} y2={4} stroke="var(--border, #e6e8f2)" strokeWidth="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          {prevData && prevData.length > 0 && (
            <path d={polyPath(prevData, false)} fill="none" stroke={prevColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" vectorEffect="non-scaling-stroke" />
          )}
          <path d={polyPath(data, true)} fill={`url(#${gradId})`} stroke="none" />
          <path d={polyPath(data, false)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {labels && labels.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text3)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
            {labels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

// BarChart — стиль «банковского приложения» (как на референс-фото):
// тонкие закруглённые бары, светлая базовая линия, даты под барами,
// без Y-оси (значение каждого бара видно по hover-подсказке).
// prevData — опциональная серая серия рядом для сравнения периодов.
export function BarChart({ data, prevData, labels, color = '#2563EB', prevColor = '#C3C8D4', height = 160, maxLabels = 6 }) {
  const { tt } = useTt();
  if (!data || data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных за период')}</div>;
  }
  const allValues = [...data, ...(prevData || [])];
  const max = Math.max(...allValues, 1);

  // Какие индексы подписать: если ненулевых баров мало — подписываем их,
  // иначе равномерно распределяем maxLabels меток.
  const labelIdx = new Set();
  if (labels && labels.length) {
    const nonZero = data.map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0);
    if (nonZero.length > 0 && nonZero.length <= maxLabels) {
      nonZero.forEach(i => labelIdx.add(i));
    } else {
      const n = Math.min(maxLabels, data.length);
      for (let k = 0; k < n; k++) labelIdx.add(Math.round((k / Math.max(n - 1, 1)) * (data.length - 1)));
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2,
        height, borderBottom: '1.5px solid var(--border, #E6E8F2)',
        paddingBottom: 0,
      }}>
        {data.map((v, i) => {
          const hPct = Math.max((v / max) * 100, v > 0 ? 3 : 0);
          const pv = prevData ? (prevData[i] || 0) : null;
          const phPct = pv != null ? Math.max((pv / max) * 100, pv > 0 ? 3 : 0) : null;
          const tip = (labels && labels[i] ? labels[i] + ' · ' : '') + fmtMoneyFull(v) +
            (pv != null ? `\n${tt('прошлый')} · ${fmtMoneyFull(pv)}` : '');
          return (
            <div key={i} className="chart-col" data-tip={tip} style={{
              flex: 1, minWidth: 0, height: '100%',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1,
            }}>
              {phPct != null && (
                <div style={{
                  width: prevData ? 'min(40%, 8px)' : 0, height: `${phPct}%`,
                  background: prevColor, borderRadius: 99,
                  minHeight: pv > 0 ? 3 : 0,
                }} />
              )}
              <div style={{
                width: prevData ? 'min(40%, 8px)' : 'min(60%, 14px)', height: `${hPct}%`,
                background: color, borderRadius: 99,
                minHeight: v > 0 ? 3 : 0,
                transition: 'height .25s ease',
              }} />
            </div>
          );
        })}
      </div>
      {labels && labels.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
          {data.map((_, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 10, color: 'var(--text3)', fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'visible', whiteSpace: 'nowrap',
            }}>
              {labelIdx.has(i) ? labels[i] : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ data, color = '#5B4FE8' }) {
  if (!data || data.length < 2) {
    return <svg className="sparkline" viewBox="0 0 100 50" preserveAspectRatio="none" />;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 100 50" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Progress({ value, max = 100, color = '#5B4FE8' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function Pills({ value, onChange, options, label = 'Выбор' }) {
  const { tt } = useTt();
  // Стрелками ←/→ переключаемся между пилюлями (как radiogroup), не теряя фокус
  const onKey = (e, idx) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % options.length
      : (idx - 1 + options.length) % options.length;
    onChange(options[next].value);
    // Переместить фокус на новую активную пилюлю
    const btns = e.currentTarget.parentElement?.querySelectorAll('button');
    btns?.[next]?.focus();
  };
  return (
    <div className="pills" role="group" aria-label={tt(label)}>
      {options.map((o, i) => (
        <button key={o.value} type="button"
          className={'pill' + (o.value === value ? ' active' : '')}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}>{o.label}</button>
      ))}
    </div>
  );
}

export function ComingSoon({ icon = '🚧', title = 'В разработке', children }) {
  const { tt } = useTt();
  return (
    <div className="card">
      <div className="coming-soon">
        <div className="coming-soon-icon">{icon}</div>
        <div className="coming-soon-title">{tt(title)}</div>
        <div style={{ maxWidth: 480 }}>{children}</div>
      </div>
    </div>
  );
}

export function Skeleton({ width, height = 12, style }) {
  return (
    <span
      className="skeleton"
      style={{ display: 'block', width: width || '100%', height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} style={{ marginBottom: 10, width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action}
    </div>
  );
}

export function Tooltip({ text, children }) {
  const id = React.useRef('tt-' + Math.random().toString(36).slice(2, 8)).current;
  // aria-describedby связывает триггер с подсказкой для скринридеров;
  // tabIndex делает её доступной с клавиатуры (CSS показывает на :focus-within)
  return (
    <span className="tooltip-host" tabIndex={0} aria-describedby={id}>
      {children}
      <span className="tooltip-bubble" role="tooltip" id={id}>{text}</span>
    </span>
  );
}

export function RequiredMark() {
  const { tt } = useTt();
  return <span className="req-asterisk" aria-label={tt('обязательное поле')}>*</span>;
}

export function FeatureGrid({ items }) {
  return (
    <div className="grid-3">
      {items.map((f, i) => (
        <div key={i} className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(91,79,232,.10)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>{f.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{f.title}</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{f.desc}</div>
          {f.metric && (
            <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
              {f.metric}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Helpers
export const fmtMoney = (v) => {
  const n = parseFloat(v) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return Math.round(n).toString();
};

// Full money formatting — «4 150 000» вместо «4.15M». Без валютного суффикса.
// Используется на главной панели и в финансовых отчётах где важна точная цифра.
export const fmtMoneyFull = (v) => (Math.round(parseFloat(v) || 0)).toLocaleString('ru-RU');

// Полная сумма + валюта
export const fmtSum = (v, currency = 'сум') => `${fmtMoneyFull(v)} ${currency}`;

// Короткий формат для оси Y графика — «4.2M» / «150K» / «25»
export const fmtAxis = (v) => {
  const n = parseFloat(v) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return Math.round(n).toString();
};

export const fmtNum = (v) => (parseFloat(v) || 0).toLocaleString('ru-RU');

// Сегодня в виде «9 июня 2026, вторник» (или по-узбекски при lang='uz')
export const todayLabel = (lang) => {
  const locale = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
  return new Date().toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  });
};

export function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = (num >> 16) + amt;
  const g = ((num >> 8) & 0xff) + amt;
  const b = (num & 0xff) + amt;
  return '#' + (
    0x1000000 + (Math.max(Math.min(r, 255), 0) * 0x10000) +
    (Math.max(Math.min(g, 255), 0) * 0x100) +
    Math.max(Math.min(b, 255), 0)
  ).toString(16).slice(1);
}
