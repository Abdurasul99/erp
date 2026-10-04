import React, { useId, useLayoutEffect, useRef, useState } from 'react';

// График безубыточности: по X — клиенты (в админке это платящие филиалы), по Y — деньги.
// Слои снизу вверх: жёлтая область постоянных расходов (0…F), красная область переменных
// (F…F+vPer·q), зелёная линия выручки, вертикаль точки безубыточности и зелёная зона
// прибыли после пересечения.
//
// Компонент ЧИСТЫЙ: бизнес-числа приходят готовыми в props.chart (это ровно
// calcBreakEven(...).chart из frontend/src/utils/breakEven.js). Внутри — только геометрия
// рисования и форматирование подписей; ни одной формулы расчёта и ни одного запроса.
//
// props:
//   chart      — { maxClients, yMax, points:[{q,fixed,cost,revenue}], hasRevenue,
//                  be:{clients,sum}|null, current:{clients,revenue,cost} }
//   money      — (v:number) => string, полный формат сумм (тултип, подпись точки БУ)
//   moneyShort — (v:number) => string, короткий формат для оси Y
//   currency   — символ валюты для подписей ('сум' | '$' | '₽')
//   height     — высота области рисования в px (по умолчанию 300)
//   beNote     — текст-объяснение, когда точки БУ нет (парент знает причину и её текст)
//   showCurrent— отмечать ли текущее положение (по умолчанию да)
//   factClients— сколько клиентов СЕЙЧАС: рисуется пунктиром с подписью

const C = {
  fixedFill: '#F7C948',   // постоянные — жёлтая
  fixedLine: '#B45309',
  varFill: '#F2555A',     // переменные — красная
  varLine: '#C2373C',
  rev: '#1D7A35',         // выручка и зона прибыли — зелёная
  be: '#173361',          // вертикаль точки БУ — денимовый акцент канона
  surface: 'var(--card, #fff)',
};

const ruNum = (v) => Math.round(v).toLocaleString('ru-RU');
const trim1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');

// Ось Y подписывается коротко: «120 млн», иначе на телефоне подписи налезают друг на друга.
function shortMoney(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return trim1(v / 1e9) + ' млрд';
  if (a >= 1e6) return trim1(v / 1e6) + ' млн';
  if (a >= 1e4) return trim1(v / 1e3) + ' тыс';
  return a < 10 ? trim1(v) : ruNum(v);
}

// Шкалу Y строим от «круглого» шага, а не от круглого потолка: округление одного
// только верха раздувало ось (159 млн превращались в 200 млн и четверть картинки пустовала).
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
function niceScale(v, want = 4) {
  if (!Number.isFinite(v) || v <= 0) return { top: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = v / want;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = (STEPS.find(s => raw / pow <= s + 1e-9) || 10) * pow;
  const top = Math.ceil(v / step - 1e-9) * step;
  const ticks = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { top, ticks };
}

// Зона прибыли — участки, где линия выручки идёт выше совокупных затрат.
// Точку пересечения досчитываем интерполяцией: без неё зелёная зона начиналась бы
// не в точке безубыточности, а в ближайшем узле сетки из 41 точки.
function profitBands(points) {
  const cross = (a, b) => {
    const d0 = a.revenue - a.cost;
    const d1 = b.revenue - b.cost;
    const t = d0 === d1 ? 0 : d0 / (d0 - d1);
    const k = Math.min(1, Math.max(0, t));
    return {
      q: a.q + (b.q - a.q) * k,
      cost: a.cost + (b.cost - a.cost) * k,
      revenue: a.revenue + (b.revenue - a.revenue) * k,
    };
  };
  const bands = [];
  let cur = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.revenue >= p.cost) {
      if (!cur) {
        cur = [];
        if (i > 0) cur.push(cross(points[i - 1], p));
      }
      cur.push(p);
    } else if (cur) {
      cur.push(cross(points[i - 1], p));
      bands.push(cur);
      cur = null;
    }
  }
  if (cur) bands.push(cur);
  return bands.filter(b => b.length > 1 && b[b.length - 1].q > b[0].q);
}

export default function BreakEvenChart({
  chart,
  money,
  moneyShort,
  currency = '',
  height = 300,
  beNote,
  showCurrent = true,
  factClients = null,   // отметка «сейчас» — видно расстояние до порога
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');   // id паттерна штриховки уникален на страницу
  const wrapRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  const [hoverI, setHoverI] = useState(null);

  // Ширину меряем, чтобы 1 единица viewBox равнялась одному CSS-пикселю: тогда SVG
  // растягивается на контейнер, но подписи не «плывут» в масштабе на 360px.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const upd = () => setBoxW(el.clientWidth || 0);
    upd();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', upd);
      return () => window.removeEventListener('resize', upd);
    }
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = Array.isArray(chart?.points) ? chart.points : [];
  const fmtFull = typeof money === 'function' ? money : (v) => (currency ? `${ruNum(v)} ${currency}` : ruNum(v));
  const fmtAxis = typeof moneyShort === 'function' ? moneyShort : shortMoney;

  const W = Math.max(260, boxW || 640);
  const H = Math.max(200, height);
  const narrow = W < 430;
  const padL = narrow ? 46 : 62;
  const padR = 14;
  const padT = 16;
  const padB = 44;                       // место под подписи оси X и её название
  const plotW = Math.max(10, W - padL - padR);
  const plotH = Math.max(10, H - padT - padB);

  const maxClients = Number.isFinite(chart?.maxClients) && chart.maxClients > 0 ? chart.maxClients : 1;
  const scale = niceScale((Number.isFinite(chart?.yMax) && chart.yMax > 0 ? chart.yMax : 1) * 1.04);
  const yTop = scale.top;
  const x = (q) => padL + (Math.min(Math.max(q, 0), maxClients) / maxClients) * plotW;
  const y = (v) => padT + (1 - Math.min(Math.max(v, 0), yTop) / yTop) * plotH;

  const fixed = points.length ? points[0].fixed : 0;
  const hasRevenue = !!chart?.hasRevenue;
  const be = chart?.be && Number.isFinite(chart.be.clients) ? chart.be : null;
  const current = chart?.current || null;

  const line = (key) => points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.q).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  const costArea = points.length
    ? `${line('cost')} L ${x(points[points.length - 1].q).toFixed(1)} ${y(fixed).toFixed(1)} L ${x(0).toFixed(1)} ${y(fixed).toFixed(1)} Z`
    : '';
  const bands = hasRevenue ? profitBands(points) : [];

  // на узком экране половину горизонталей убираем — подписи 10.5px иначе слипаются
  const yTicks = narrow && scale.ticks.length > 4 ? scale.ticks.filter((_, i) => i % 2 === 0) : scale.ticks;
  const xTickCount = narrow ? 3 : 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => (maxClients * i) / (xTickCount - 1));

  const hover = hoverI != null && points[hoverI] ? points[hoverI] : null;

  const onMove = (e) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // до первого замера ширины единица viewBox может не равняться CSS-пикселю — приводим
    const px = (e.clientX - rect.left) * (W / (rect.width || W));
    const t = (px - padL) / plotW;
    setHoverI(Math.round(Math.min(1, Math.max(0, t)) * (points.length - 1)));
  };

  const legend = [
    { key: 'fixed', label: 'Постоянные', swatch: { background: C.fixedFill, opacity: 0.55, border: `1px solid ${C.fixedLine}` } },
    { key: 'var', label: 'Переменные', swatch: { background: C.varFill, opacity: 0.5, border: `1px solid ${C.varLine}` } },
    { key: 'rev', label: 'Выручка', swatch: { background: C.rev, height: 3, borderRadius: 2 } },
    // Зону прибыли отличаем не только цветом, но и штриховкой: зелёный и красный
    // рядом плохо различимы при дальтонизме.
    { key: 'profit', label: 'Прибыль', swatch: { background: `repeating-linear-gradient(45deg, ${C.rev}55 0 3px, ${C.rev}14 3px 6px)`, border: `1px solid ${C.rev}` } },
  ];

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
      {!points.length ? (
        <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Недостаточно данных для графика
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
            style={{ display: 'block', touchAction: 'pan-y' }}
            role="img"
            aria-label={`График безубыточности: постоянные расходы ${fmtFull(fixed)}, ось X — клиенты до ${ruNum(maxClients)}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHoverI(null)}
          >
            <defs>
              <pattern id={`bepHatch${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={C.rev} opacity="0.1" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={C.rev} strokeWidth="2.2" opacity="0.34" />
              </pattern>
              <clipPath id={`bepClip${uid}`}>
                <rect x={padL} y={padT} width={plotW} height={plotH} />
              </clipPath>
            </defs>

            {/* сетка */}
            {yTicks.map((v, i) => (
              <line key={i} x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)}
                stroke="var(--border, #E5E7EB)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 3'} />
            ))}

            <g clipPath={`url(#bepClip${uid})`}>
              {/* постоянные: от нуля до F, одинаковы при любом числе клиентов */}
              {fixed > 0 && (
                <rect x={padL} y={y(fixed)} width={plotW} height={Math.max(0, y(0) - y(fixed))}
                  fill={C.fixedFill} opacity="0.45" />
              )}
              {/* переменные: от F до совокупных затрат */}
              {costArea && <path d={costArea} fill={C.varFill} opacity="0.34" />}
              {/* зона прибыли: выручка выше совокупных затрат */}
              {bands.map((b, bi) => {
                const up = b.map((p, i) => `${i ? 'L' : 'M'} ${x(p.q).toFixed(1)} ${y(p.revenue).toFixed(1)}`).join(' ');
                const down = b.slice().reverse().map(p => `L ${x(p.q).toFixed(1)} ${y(p.cost).toFixed(1)}`).join(' ');
                return <path key={bi} d={`${up} ${down} Z`} fill={`url(#bepHatch${uid})`} />;
              })}

              {/* граница постоянных: белый зазор + линия, чтобы жёлтое и красное не слипались */}
              {fixed > 0 && (
                <>
                  <line x1={padL} x2={padL + plotW} y1={y(fixed)} y2={y(fixed)} stroke={C.surface} strokeWidth="3" />
                  <line x1={padL} x2={padL + plotW} y1={y(fixed)} y2={y(fixed)} stroke={C.fixedLine} strokeWidth="1.5" strokeDasharray="5 4" />
                </>
              )}
              <path d={line('cost')} fill="none" stroke={C.varLine} strokeWidth="2" strokeLinejoin="round" />
              {hasRevenue && <path d={line('revenue')} fill="none" stroke={C.rev} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}

              {/* вертикаль точки безубыточности; при marge <= 0 её просто нет */}
              {be && be.clients <= maxClients && (
                <>
                  <line x1={x(be.clients)} x2={x(be.clients)} y1={padT} y2={padT + plotH}
                    stroke={C.be} strokeWidth="1.6" strokeDasharray="6 4" />
                  <circle cx={x(be.clients)} cy={y(be.sum)} r="5" fill={C.be} stroke={C.surface} strokeWidth="2" />
                </>
              )}

              {showCurrent && hasRevenue && current && current.clients > 0 && current.clients <= maxClients && (
                <circle cx={x(current.clients)} cy={y(current.revenue)} r="4.5" fill={C.rev} stroke={C.surface} strokeWidth="2" />
              )}

              {/* «Сейчас»: пунктир от оси до линии выручки — расстояние до порога видно глазом */}
              {Number.isFinite(factClients) && factClients > 0 && factClients <= maxClients && (
                <line x1={x(factClients)} x2={x(factClients)} y1={padT} y2={padT + plotH}
                  stroke="var(--text3, #8E8E96)" strokeWidth="1.5" strokeDasharray="4 4" />
              )}

              {hover && (
                <line x1={x(hover.q)} x2={x(hover.q)} y1={padT} y2={padT + plotH}
                  stroke="var(--text3, #8E8E96)" strokeWidth="1" />
              )}
            </g>

            {/* подпись «сейчас» — над пунктиром текущего положения */}
            {Number.isFinite(factClients) && factClients > 0 && factClients <= maxClients && (
              <text x={x(factClients)} y={padT - 3} textAnchor="middle"
                fontSize="11" fontWeight="700" fill="var(--text3, #8E8E96)">
                {'сейчас: ' + ruNum(factClients)}
              </text>
            )}

            {/* подпись точки БУ: у правого края разворачиваем влево, иначе текст уедет за холст */}
            {be && be.clients <= maxClients && (
              <text
                x={x(be.clients) + (x(be.clients) > padL + plotW * 0.62 ? -8 : 8)}
                y={padT + 11}
                textAnchor={x(be.clients) > padL + plotW * 0.62 ? 'end' : 'start'}
                fontSize="11.5" fontWeight="700" fill={C.be}
              >
                {`Точка БУ · ${ruNum(Math.ceil(be.clients - 1e-9))} фил.`}
              </text>
            )}

            {/* оси */}
            <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--border, #E5E7EB)" strokeWidth="1" />
            {yTicks.map((v, i) => (
              <text key={i} x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--text3, #8E8E96)">
                {i === 0 ? '0' : fmtAxis(v)}
              </text>
            ))}
            {xTicks.map((q, i) => (
              <text key={i} x={x(q)} y={padT + plotH + 17}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                fontSize="10.5" fill="var(--text3, #8E8E96)">
                {ruNum(q)}
              </text>
            ))}
            <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text3, #8E8E96)">
              Клиентов (филиалов){currency ? ` · деньги в ${currency}` : ''}
            </text>
          </svg>

          {hover && (
            <div style={{
              position: 'absolute', top: padT + 4,
              ...(x(hover.q) > W / 2 ? { right: Math.max(8, W - x(hover.q) + 10) } : { left: Math.min(W - 176, x(hover.q) + 10) }),
              maxWidth: 168, background: 'var(--card, #fff)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 6px 18px rgba(16,24,40,.12)', padding: '8px 10px',
              fontSize: 12, lineHeight: 1.5, pointerEvents: 'none', zIndex: 2,
            }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{ruNum(hover.q)} филиалов</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text3)' }}>Выручка</span>
                <strong>{hasRevenue ? fmtFull(hover.revenue) : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text3)' }}>Расходы</span>
                <strong>{fmtFull(hover.cost)}</strong>
              </div>
              {hasRevenue && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'var(--text3)' }}>Прибыль</span>
                  <strong style={{ color: hover.revenue - hover.cost >= 0 ? C.rev : C.varLine }}>
                    {fmtFull(hover.revenue - hover.cost)}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 10 }}>
            {legend.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, minWidth: 0 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, flexShrink: 0, ...item.swatch }} />
                {item.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
            {be
              ? `Пересечение выручки и затрат — точка безубыточности: ${ruNum(Math.ceil(be.clients - 1e-9))} филиалов, ${fmtFull(be.sum)}.`
              : (beNote || 'Точка безубыточности на графике не отмечена: при текущих вводных пересечения нет.')}
            {!hasRevenue && ' Средний чек неизвестен, поэтому линия выручки не построена.'}
          </div>
        </>
      )}
    </div>
  );
}
