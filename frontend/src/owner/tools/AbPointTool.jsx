import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'month',   label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
];

// Категории KPI и их метрики. type определяет форматирование значения.
const GROUPS = [
  {
    key: 'fin', icon: '💰', title: 'Финансы', color: '#1D4ED8',
    metrics: [
      { key: 'revenue',   label: 'Выручка',      type: 'money', goodUp: true },
      { key: 'profit',    label: 'Прибыль',      type: 'money', goodUp: true },
      { key: 'margin',    label: 'Маржа',        type: 'pct',   goodUp: true },
      { key: 'avg_check', label: 'Средний чек',  type: 'money', goodUp: true },
    ],
  },
  {
    key: 'proc', icon: '⚙️', title: 'Процессы', color: '#0EA5E9',
    metrics: [
      { key: 'deals',     label: 'Сделок',       type: 'num',  goodUp: true },
      { key: 'employees', label: 'Сотрудников',  type: 'num',  goodUp: true },
    ],
  },
  {
    key: 'cli', icon: '🧑‍🤝‍🧑', title: 'Клиенты', color: '#16A34A',
    metrics: [
      { key: 'customers',        label: 'Клиентов',          type: 'num', goodUp: true },
      { key: 'repeat_customers', label: 'Повторные клиенты', type: 'num', goodUp: true },
      { key: 'retention',        label: 'Retention',         type: 'pct', goodUp: true },
      { key: 'ltv',              label: 'LTV',               type: 'money', goodUp: true },
    ],
  },
];

const ALL_METRICS = GROUPS.flatMap(g => g.metrics.map(m => ({ ...m, group: g.key })));
const METRIC_BY_KEY = Object.fromEntries(ALL_METRICS.map(m => [m.key, m]));

const fmtVal = (type, v) => {
  const n = parseFloat(v) || 0;
  if (type === 'money') return fmtMoney(n);
  if (type === 'pct') return `${(Math.round(n * 10) / 10).toLocaleString('ru-RU')}%`;
  return fmtNum(n);
};

const fmtDelta = (type, v) => {
  const n = parseFloat(v) || 0;
  const sign = n > 0 ? '+' : '';
  if (type === 'money') return `${sign}${fmtMoney(n)}`;
  if (type === 'pct') return `${sign}${(Math.round(n * 10) / 10).toLocaleString('ru-RU')} п.п.`;
  return `${sign}${fmtNum(n)}`;
};

// localStorage-ключ точки A — отдельный на (период + филиал).
const lsKey = (period, branchId) => `abPoint:A:${period}:${branchId || 'all'}`;

// Мини-чарт линии A→B (две точки) — SVG.
function MiniLine({ a, b, color = '#1D4ED8' }) {
  const va = parseFloat(a) || 0, vb = parseFloat(b) || 0;
  const max = Math.max(va, vb, 1), min = Math.min(va, vb, 0);
  const range = max - min || 1;
  const W = 80, H = 28, pad = 4;
  const y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad);
  const x1 = pad, x2 = W - pad;
  const up = vb >= va;
  const stroke = up ? '#16A34A' : '#DC2626';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }} preserveAspectRatio="none">
      <line x1={x1} y1={y(va)} x2={x2} y2={y(vb)} stroke={stroke} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x1} cy={y(va)} r="2.6" fill="#94A0B5" vectorEffect="non-scaling-stroke" />
      <circle cx={x2} cy={y(vb)} r="2.8" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function AbPointTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [pointB, setPointB] = useState(null);     // текущие метрики из системы
  const [pointA, setPointA] = useState(null);     // зафиксировано пользователем (localStorage)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка точки B (текущие метрики) + чтение точки A из localStorage.
  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/ab-point', { params })
      .then(r => { if (!ignore) setPointB(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    try {
      const raw = localStorage.getItem(lsKey(period, branchId));
      setPointA(raw ? JSON.parse(raw) : null);
    } catch { setPointA(null); }
    return () => { ignore = true; };
  }, [branchId, period]);

  // Зафиксировать точку A = текущие метрики (точка B) + текущая дата.
  function fixPointA() {
    if (!pointB) return;
    const snapshot = {
      date: new Date().toISOString(),
      metrics: pointB.metrics || {},
    };
    try {
      localStorage.setItem(lsKey(period, branchId), JSON.stringify(snapshot));
      setPointA(snapshot);
      toast(tt('Точка A зафиксирована'), 'success');
    } catch (e) {
      toast(e.message || tt('Не удалось сохранить'), 'error');
    }
  }

  function clearPointA() {
    try { localStorage.removeItem(lsKey(period, branchId)); } catch { /* ignore */ }
    setPointA(null);
    toast(tt('Точка A удалена'), 'success');
  }

  const bMetrics = pointB?.metrics || {};
  const aMetrics = pointA?.metrics || {};
  const bDate = pointB?.as_of || new Date().toISOString();
  const aDate = pointA?.date || null;

  const dateLabel = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  // Строки таблицы сравнения.
  const rows = useMemo(() => ALL_METRICS.map(m => {
    const bv = parseFloat(bMetrics[m.key]) || 0;
    const av = pointA ? (parseFloat(aMetrics[m.key]) || 0) : null;
    const dAbs = av != null ? bv - av : null;
    const dPct = av != null && av !== 0 ? Math.round(((bv - av) / Math.abs(av)) * 1000) / 10 : null;
    let dir = 'flat';
    if (dAbs != null) dir = dAbs > 0 ? 'up' : dAbs < 0 ? 'down' : 'flat';
    return { ...m, av, bv, dAbs, dPct, dir };
  }), [bMetrics, aMetrics, pointA]);

  const hasA = !!pointA;

  return (
    <>
      <PageHeader
        title={tt('⚖️ A/B точка')}
        sub={tt('Сравнение метрик компании: точка A (зафиксирована) → точка B (сейчас)')}
      />

      {/* Контролы в ТЕЛЕ инструмента (не в топбаре) — иначе кнопка/пилюли берут устаревшее
          замыкание (loading/pointB момента монтирования) и «Зафиксировать A» остаётся мёртвой. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
        <button className="btn btn-sm" onClick={fixPointA} disabled={loading || !pointB}>
          {hasA ? tt('🔄 Обновить точку A') : tt('📌 Зафиксировать точку A')}
        </button>
        {hasA && <button className="btn btn-sm btn-ghost" onClick={clearPointA}>{tt('Сбросить A')}</button>}
      </div>

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : !pointB ? (
        <EmptyState icon="⚖️" title={tt('Нет данных')} description={tt('Недостаточно данных за период')} />
      ) : (
        <>
          {/* Подсказка о фиксации точки A */}
          {!hasA && (
            <Card style={{ marginBottom: 16, background: 'rgba(29,78,216,.06)', borderColor: 'rgba(29,78,216,.25)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📌</span>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800 }}>{tt('Точка A ещё не зафиксирована')}</div>
                  <div style={{ color: 'var(--text2)' }}>
                    {tt('Зафиксируйте текущие метрики как точку A — позже вернитесь и сравните их с новыми данными (точка B). Точка A хранится локально в браузере.')}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={fixPointA}>{tt('Зафиксировать')}</button>
              </div>
            </Card>
          )}

          {/* Две даты A/B */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Tile icon="🅰️" label={tt('Точка A (зафиксирована)')} value={hasA ? dateLabel(aDate) : tt('не задана')}
              sub={hasA ? tt('снимок метрик') : tt('нажмите «Зафиксировать точку A»')} color="#94A0B5" />
            <Tile icon="🅱️" label={tt('Точка B (сейчас)')} value={dateLabel(bDate)}
              sub={tt('текущие данные системы')} color="#1D4ED8" />
          </div>

          {/* KPI-хайлайты по категориям */}
          {GROUPS.map(g => (
            <Card key={g.key} icon={g.icon} title={tt(g.title)} style={{ marginBottom: 16 }}>
              <div className="grid-4">
                {g.metrics.map(m => {
                  const r = rows.find(x => x.key === m.key);
                  const delta = (hasA && r.dPct != null)
                    ? (m.goodUp ? r.dPct : -r.dPct)
                    : null;
                  return (
                    <Tile key={m.key} label={tt(m.label)}
                      value={fmtVal(m.type, r.bv)}
                      delta={delta}
                      sub={hasA ? `${tt('A')}: ${fmtVal(m.type, r.av)}` : tt('нет точки A')}
                      color={g.color} />
                  );
                })}
              </div>
            </Card>
          ))}

          {/* Таблица сравнения A vs B */}
          <Card icon="📊" title={tt('Сравнение A → B')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Метрика')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('A')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({dateLabel(aDate)})</span></th>
                    <th style={{ textAlign: 'right' }}>{tt('B')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({dateLabel(bDate)})</span></th>
                    <th style={{ textAlign: 'right' }}>{tt('Δ абс')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Δ %')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Динамика')}</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(g => (
                    <React.Fragment key={g.key}>
                      <tr>
                        <td colSpan={6} style={{ fontWeight: 800, fontSize: 12, color: g.color, background: 'var(--bg2, #F8FAFC)', padding: '6px 10px' }}>
                          {g.icon} {tt(g.title)}
                        </td>
                      </tr>
                      {g.metrics.map(m => {
                        const r = rows.find(x => x.key === m.key);
                        const good = m.goodUp ? r.dir === 'up' : r.dir === 'down';
                        const bad = m.goodUp ? r.dir === 'down' : r.dir === 'up';
                        const deltaColor = !hasA ? 'var(--text3)' : good ? 'var(--green, #16A34A)' : bad ? 'var(--red, #DC2626)' : 'var(--text2)';
                        return (
                          <tr key={m.key}>
                            <td style={{ fontWeight: 700 }}>{tt(m.label)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                              {hasA ? fmtVal(m.type, r.av) : '—'}
                            </td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtVal(m.type, r.bv)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: deltaColor, fontWeight: 700 }}>
                              {hasA && r.dAbs != null ? fmtDelta(m.type, r.dAbs) : '—'}
                            </td>
                            <td className="mono" style={{ textAlign: 'right', color: deltaColor, fontWeight: 700 }}>
                              {hasA && r.dPct != null ? `${r.dPct > 0 ? '+' : ''}${r.dPct.toLocaleString('ru-RU')}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {!hasA ? <span style={{ color: 'var(--text3)' }}>—</span>
                                : <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <MiniLine a={r.av} b={r.bv} color={g.color} />
                                    <Badge tone={good ? 'green' : bad ? 'red' : 'gray'}>
                                      {r.dir === 'up' ? '▲' : r.dir === 'down' ? '▼' : '■'}
                                    </Badge>
                                  </div>}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('Точка A — снимок метрик, который вы фиксируете вручную (хранится локально в браузере, отдельно для каждого периода и филиала). Точка B — текущие метрики из системы. Δ % считается относительно точки A. «Динамика» зелёная, если изменение к лучшему.')}
          </div>
        </>
      )}
    </>
  );
}
