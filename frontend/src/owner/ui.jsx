import React from 'react';
import { useTt, fmtDate } from './tt.js';
import { PageHeaderContext } from './PageHeaderContext.js';

// UI primitives — class names match the prototype's so the 47 copied tools render correctly.
// All styles are scoped via .owner-shell in owner/styles.css, so they only apply inside the shell.

// ═══ Минимализм: эмодзи убраны из интерфейса ЦЕНТРАЛЬНО ═══
// Инструменты (60+ файлов) исторически передают эмодзи в title/label/icon —
// вместо правки каждого файла все примитивы (Tile/Card/PageHeader/Badge/Pills)
// прогоняют строки через stripEmoji. icon-пропсы принимаются, но не рендерятся.
export const stripEmoji = (s) => {
  if (typeof s !== 'string') return s;
  const out = s.replace(/[\p{Extended_Pictographic}️‍⃣]/gu, '').replace(/\s{2,}/g, ' ').trim();
  // «· текст» / «: текст» после вырезанного эмодзи в начале — подчистить
  return out.replace(/^[·:•\-–]\s*/, '');
};

export function Tile({ icon, label, value, sub, delta, color = 'var(--text)' }) {
  const { tt } = useTt();
  return (
    <div className="tile">
      <div className="tile-label">{stripEmoji(label)}</div>
      <div className="tile-value" style={{ color }}>{value}</div>
      {delta != null && (
        <div className={'tile-delta ' + (delta >= 0 ? 'up' : 'down')}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}% {tt('к прошлому периоду')}
        </div>
      )}
      {sub && <div className="tile-sub">{stripEmoji(sub)}</div>}
    </div>
  );
}

export function Card({ icon, title, actions, children, style }) {
  return (
    <div className="card" style={style}>
      {(title || actions) && (
        <div className="card-header">
          {title && <span>{stripEmoji(title)}</span>}
          {actions && <div className="card-header-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ tone = 'blue', children }) {
  return <span className={'badge badge-' + tone}>{typeof children === 'string' ? stripEmoji(children) : children}</span>;
}

export function Bars({ data, max, color = '#2563EB' }) {
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
export function AreaChart({ data, prevData, color = '#2563EB', prevColor = '#94A0B5', height = 160, labels = null, yAxis = true }) {
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
          fontSize: 9,
          color: 'var(--text3)', fontWeight: 700, minWidth: 66, textAlign: 'right',
          height, whiteSpace: 'nowrap',
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
          <line x1="0" y1={H - 4} x2={W} y2={H - 4} stroke="var(--border, #E3EAF3)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--border, #E3EAF3)" strokeWidth="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={4} x2={W} y2={4} stroke="var(--border, #E3EAF3)" strokeWidth="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          {prevData && prevData.length > 0 && (
            <path d={polyPath(prevData, false)} fill="none" stroke={prevColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" vectorEffect="non-scaling-stroke" />
          )}
          <path d={polyPath(data, true)} fill={`url(#${gradId})`} stroke="none" />
          <path d={polyPath(data, false)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {labels && labels.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>
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
// peakIdx — индекс «пикового» бара: он окрашивается в peakColor (тёмный),
//   остальные — в normalColor (светлый). Если peakIdx < 0 — все бары цвета color.
export function BarChart({ data, prevData, labels, color = '#1D4ED8', prevColor = '#C3C8D4', height = 160, maxLabels = 6, peakIdx = -1, peakColor = '#1D4ED8', normalColor = '#93C5FD' }) {
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
        height, borderBottom: '1.5px solid var(--border, #E3EAF3)',
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
                background: peakIdx >= 0 ? (i === peakIdx ? peakColor : normalColor) : color, borderRadius: 99,
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
              fontVariantNumeric: 'tabular-nums',
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

export function Sparkline({ data, color = '#2563EB', height = 54 }) {
  if (!data || data.length < 2) {
    return <svg viewBox="0 0 300 54" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} />;
  }
  // Широкий viewBox (близко к реальной ширине) → preserveAspectRatio="none" почти не искажает безье.
  const W = 300, H = 54, padX = 3, padY = 9;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const X = (i) => padX + (i / (data.length - 1)) * (W - 2 * padX);
  const Y = (v) => padY + (1 - (v - min) / range) * (H - 2 * padY);
  const pts = data.map((v, i) => [X(i), Y(v)]);
  // Мягкая кривая (Catmull-Rom с малым натяжением t=0.1 → почти без выбросов «горкой»).
  const t = 0.1;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const gid = 'spark-' + Math.random().toString(36).slice(2, 8);
  const area = `${d} L ${W - padX} ${H} L ${padX} ${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Progress({ value, max = 100, color = 'var(--primary)' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

// Заголовок страницы вынесен в ТОПБАР: PageHeader ничего не рисует в контенте,
// а «публикует» {title, sub, actions} в топбар шелла через PageHeaderContext.
export function PageHeader({ title, sub, actions }) {
  const setHeader = React.useContext(PageHeaderContext);
  React.useEffect(() => {
    // Эмодзи из заголовков вычищаются здесь — единая точка для всех инструментов.
    setHeader({ title: stripEmoji(title), sub: stripEmoji(sub), actions });
    return () => setHeader({ title: '', sub: null, actions: null });
    // actions намеренно не в deps (JSX — новый объект каждый рендер → цикл); ок для статичных actions
  }, [title, sub, setHeader]);
  return null;
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
          onKeyDown={(e) => onKey(e, i)}>{stripEmoji(o.label)}</button>
      ))}
    </div>
  );
}

export function ComingSoon({ title = 'В разработке', children }) {
  const { tt } = useTt();
  return (
    <div className="card">
      <div className="coming-soon">
        <div className="coming-soon-title">{stripEmoji(tt(title))}</div>
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

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{stripEmoji(title)}</div>
      {description && <div className="empty-state-desc">{stripEmoji(description)}</div>}
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
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{stripEmoji(f.title)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{stripEmoji(f.desc)}</div>
          {f.metric && (
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
              {f.metric}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Helpers
// Всегда ПОЛНОЕ число с разделителями разрядов: «4 150 000», без K/M/B.
// (По требованию: суммы и любые числа пишем полностью, без сокращений.)
export const fmtMoney = (v) => (Math.round(parseFloat(v) || 0)).toLocaleString('ru-RU');

// Full money formatting — «4 150 000» вместо «4.15M». Без валютного суффикса.
// Используется на главной панели и в финансовых отчётах где важна точная цифра.
export const fmtMoneyFull = (v) => (Math.round(parseFloat(v) || 0)).toLocaleString('ru-RU');

// Полная сумма + валюта
export const fmtSum = (v, currency = 'сум') => `${fmtMoneyFull(v)} ${currency}`;

// Ось Y графика — тоже полное число (без K/M), с разделителями разрядов.
export const fmtAxis = (v) => (Math.round(parseFloat(v) || 0)).toLocaleString('ru-RU');

export const fmtNum = (v) => (parseFloat(v) || 0).toLocaleString('ru-RU');

// Сегодня в виде «9 июня 2026, вторник» (или по-узбекски при lang='uz')
export const todayLabel = (lang) => fmtDate(new Date(), {
  day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
}, lang);

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
