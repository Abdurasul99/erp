import React, { useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

const BLUE = 'var(--chart-blue)';

export function Sparkline({ data, width = 96, height = 30, color = BLUE }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Линия/область с crosshair-тултипом (одна серия — имя серии в заголовке карточки)
export function AreaChart({ data, labels, height = 190, format = (v) => v, id = 'a' }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640, H = height, PAD_B = 20, PAD_T = 12;

  const pts = useMemo(() => {
    const mn = Math.min(...data) * 0.92, mx = Math.max(...data) * 1.04;
    return data.map((v, i) => ({
      x: (i / (data.length - 1)) * W,
      y: PAD_T + (1 - (v - mn) / (mx - mn)) * (H - PAD_B - PAD_T),
      v, i,
    }));
  }, [data, H]);

  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M0,${H - PAD_B} L${line.replace(/ /g, ' L')} L${W},${H - PAD_B} Z`;

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((x / W) * (data.length - 1))));
    setHover({ ...pts[idx], px: (pts[idx].x / W) * rect.width, py: (pts[idx].y / H) * rect.height });
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        style={{ display: 'block', cursor: 'crosshair' }} role="img" aria-label="График динамики"
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4da3ff" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#4da3ff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.55, 0.85].map((g) => (
          <line key={g} x1="0" x2={W} y1={PAD_T + g * (H - PAD_B - PAD_T)} y2={PAD_T + g * (H - PAD_B - PAD_T)} stroke="var(--chart-grid)" strokeWidth="1" />
        ))}
        <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="var(--chart-axis)" strokeWidth="1" />
        <motion.path d={area} fill={`url(#grad-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
        <motion.polyline
          points={line} fill="none" stroke={BLUE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 7px rgba(77, 163, 255, 0.45))' }}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}
        />
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={PAD_T} y2={H - PAD_B} stroke="var(--chart-axis)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hover.x} cy={hover.y} r="4.5" fill="var(--chart-blue)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.px, top: hover.py }}>
          <div className="tt-label">{labels[hover.i]}</div>
          <div className="tt-val">{format(hover.v)}</div>
        </div>
      )}
    </div>
  );
}

// Дивергентные столбики (приход/расход): положительное — синий, отрицательное — красный
export function FlowBars({ data, labels, height = 150, format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map(Math.abs)) || 1;
  const W = 640, H = height, mid = H / 2;
  const bw = W / data.length;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }} role="img" aria-label="Денежный поток по дням">
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--chart-axis)" strokeWidth="1" />
        {data.map((v, i) => {
          const h = (Math.abs(v) / max) * (H / 2 - 8);
          return (
            <motion.rect
              key={i}
              x={i * bw + bw * 0.18} width={bw * 0.64}
              y={v >= 0 ? mid - h : mid + 1}
              rx="3"
              fill={v >= 0 ? 'var(--chart-blue)' : 'var(--bad)'}
              initial={{ height: 0, y: mid }}
              animate={{ height: Math.max(h, 2), y: v >= 0 ? mid - h : mid + 1 }}
              transition={{ duration: 0.6, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={(e) => setHover({ i, v, px: ((i * bw + bw / 2) / W) * 100 })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.px + '%', top: 8 }}>
          <div className="tt-label">{labels[hover.i]}</div>
          <div className="tt-val" style={{ color: hover.v >= 0 ? 'var(--good-text)' : 'var(--bad)' }}>
            {(hover.v >= 0 ? '+' : '−') + format(Math.abs(hover.v))}
          </div>
        </div>
      )}
    </div>
  );
}

// Кольцо BHI (одно значение + статусная зона)
export function Ring({ value, size = 124, label }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = value >= 70 ? 'var(--good)' : value >= 45 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`BHI ${value} из 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth="9" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</span>
        {label && <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>}
      </div>
    </div>
  );
}

// Горизонтальные бары — секвенциальные шаги синего, прямые подписи значений
const BAR_STEPS = ['var(--chart-blue)', '#5598e7', '#86b6ef'];
export function BranchBars({ rows, format = (v) => v }) {
  const max = Math.max(...rows.map((r) => r.v));
  return (
    <div>
      {rows.map((r, i) => (
        <div className="bar-row" key={r.name}>
          <span className="bar-name">{r.name}</span>
          <div className="bar-track">
            <motion.div
              className="bar-fill"
              style={{ background: BAR_STEPS[Math.min(i, BAR_STEPS.length - 1)] }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.v / max) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
            />
          </div>
          <span className="bar-val">{format(r.v)}</span>
        </div>
      ))}
    </div>
  );
}
