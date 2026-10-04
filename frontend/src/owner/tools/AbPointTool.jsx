import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { AuthContext } from '../../App.jsx';
import { Modal, toast } from '../Modal.jsx';
import { normalizeDecimal } from '../../utils/decimalInput.js';
import { useTt } from '../tt.js';

// A/B точка: «где были» → «где сейчас».
// Замеры (точка A) ЖИВУТ НА СЕРВЕРЕ (ab_points): раньше снимок лежал в
// localStorage — терялся при смене устройства, не был виден коллегам и не давал
// истории. Теперь их можно копить, выбирать любой для сравнения, вводить руками
// («было до ремонта») и удалять.

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

const dateLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};
const dateTimeLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Старая точка A из localStorage — переносим одним нажатием, чтобы у тех, кто
// уже фиксировал замер, он не пропал вместе с обновлением.
const legacyKey = (period, branchId) => `abPoint:A:${period}:${branchId || 'all'}`;

// Мини-чарт линии A→B (две точки) — SVG.
function MiniLine({ a, b }) {
  const va = parseFloat(a) || 0, vb = parseFloat(b) || 0;
  const max = Math.max(va, vb, 1), min = Math.min(va, vb, 0);
  const range = max - min || 1;
  const W = 80, H = 28, pad = 4;
  const y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad);
  const stroke = vb >= va ? '#16A34A' : '#DC2626';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }} preserveAspectRatio="none">
      <line x1={pad} y1={y(va)} x2={W - pad} y2={y(vb)} stroke={stroke} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pad} cy={y(va)} r="2.6" fill="#94A0B5" vectorEffect="non-scaling-stroke" />
      <circle cx={W - pad} cy={y(vb)} r="2.8" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Числовое поле ручного замера: стейт — строка, приведение к числу только при
// сохранении. Иначе не стереть первую цифру и ломается ввод с запятой.
function NumField({ label, hint, value, onChange }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label className="label">{label}</label>
      <input className="input" type="text" inputMode="decimal" value={value}
        placeholder="0" style={{ textAlign: 'right', fontWeight: 700 }}
        onChange={e => onChange(e.target.value.replace(/[^\d.,\s-]/g, ''))} />
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const toNum = (s) => {
  const n = parseFloat(normalizeDecimal(s));
  return Number.isFinite(n) ? n : 0;
};

export default function AbPointTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const { user } = useContext(AuthContext);
  const [period, setPeriod] = useState('month');
  const [pointB, setPointB] = useState(null);       // текущие метрики из системы
  const [snaps, setSnaps] = useState([]);           // сохранённые замеры (сервер)
  const [pickedId, setPickedId] = useState(null);   // какой замер сравниваем
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [legacy, setLegacy] = useState(null);       // старый замер из браузера

  // Форма ручного замера
  const [manualOpen, setManualOpen] = useState(false);
  const [mLabel, setMLabel] = useState('');
  const [mDate, setMDate] = useState('');
  const [mNote, setMNote] = useState('');
  const [mVals, setMVals] = useState({});

  const canEdit = ['founder', 'director', 'admin', 'manager'].includes(user?.role);

  const loadSnaps = useCallback((sel) => {
    const params = { period };
    if (branchId) params.branch_id = branchId;
    return api.get('/analytics/ab-point/snapshots', { params })
      .then(r => {
        const list = r.data?.snapshots || [];
        setSnaps(list);
        // По умолчанию сравниваем с самым свежим замером.
        setPickedId(prev => (sel != null ? sel : (list.some(s => s.id === prev) ? prev : (list[0]?.id ?? null))));
        return list;
      });
  }, [period, branchId]);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    Promise.all([
      api.get('/analytics/ab-point', { params }),
      api.get('/analytics/ab-point/snapshots', { params }).catch(() => ({ data: { snapshots: [] } })),
    ])
      .then(([b, s]) => {
        if (ignore) return;
        setPointB(b.data);
        const list = s.data?.snapshots || [];
        setSnaps(list);
        setPickedId(list[0]?.id ?? null);
      })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });

    // Замер из старой версии (браузерный) — покажем предложение перенести.
    try {
      const raw = localStorage.getItem(legacyKey(period, branchId));
      setLegacy(raw ? JSON.parse(raw) : null);
    } catch { setLegacy(null); }
    return () => { ignore = true; };
  }, [branchId, period]);

  const picked = useMemo(() => snaps.find(s => s.id === pickedId) || null, [snaps, pickedId]);
  const bMetrics = pointB?.metrics || {};
  const aMetrics = picked?.metrics || {};
  const hasA = !!picked;

  // Зафиксировать замер по текущим данным. Цифры считает СЕРВЕР — снимок и
  // экран всегда из одного расчёта.
  const capture = () => {
    setSaving(true);
    api.post('/analytics/ab-point/snapshots', {
      period, branch_id: branchId || undefined, source: 'system',
      label: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    })
      .then(r => loadSnaps(r.data?.id).then(() => toast(tt('Замер сохранён'), 'success')))
      .catch(e => toast(e.response?.data?.error || e.message, 'error'))
      .finally(() => setSaving(false));
  };

  const remove = (id) => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.delete(`/analytics/ab-point/snapshots/${id}`, { params })
      .then(() => loadSnaps(null).then(() => toast(tt('Замер удалён'), 'success')))
      .catch(e => toast(e.response?.data?.error || e.message, 'error'));
  };

  const openManual = () => {
    // Предзаполняем текущими значениями — так проще править одно-два числа.
    const pre = {};
    ALL_METRICS.forEach(m => { pre[m.key] = String(Math.round((parseFloat(bMetrics[m.key]) || 0) * 10) / 10); });
    setMVals(pre);
    setMLabel(''); setMNote(''); setMDate('');
    setManualOpen(true);
  };

  const saveManual = () => {
    const metrics = {};
    ALL_METRICS.forEach(m => { metrics[m.key] = toNum(mVals[m.key]); });
    setSaving(true);
    api.post('/analytics/ab-point/snapshots', {
      period, branch_id: branchId || undefined, source: 'manual',
      label: mLabel || tt('Ручной замер'), note: mNote,
      captured_at: mDate ? new Date(mDate).toISOString() : undefined,
      metrics,
    })
      .then(r => {
        setManualOpen(false);
        return loadSnaps(r.data?.id).then(() => toast(tt('Замер сохранён'), 'success'));
      })
      .catch(e => toast(e.response?.data?.error || e.message, 'error'))
      .finally(() => setSaving(false));
  };

  // Перенос старого браузерного замера в общий список.
  const importLegacy = () => {
    if (!legacy) return;
    setSaving(true);
    const metrics = {};
    ALL_METRICS.forEach(m => { metrics[m.key] = parseFloat(legacy.metrics?.[m.key]) || 0; });
    api.post('/analytics/ab-point/snapshots', {
      period, branch_id: branchId || undefined, source: 'manual',
      label: tt('Перенесён из браузера'), captured_at: legacy.date, metrics,
    })
      .then(r => {
        try { localStorage.removeItem(legacyKey(period, branchId)); } catch { /* ignore */ }
        setLegacy(null);
        return loadSnaps(r.data?.id).then(() => toast(tt('Замер перенесён на сервер'), 'success'));
      })
      .catch(e => toast(e.response?.data?.error || e.message, 'error'))
      .finally(() => setSaving(false));
  };

  // Строки сравнения A → B.
  const rows = useMemo(() => ALL_METRICS.map(m => {
    const bv = parseFloat(bMetrics[m.key]) || 0;
    const av = hasA ? (parseFloat(aMetrics[m.key]) || 0) : null;
    const dAbs = av != null ? bv - av : null;
    const dPct = av != null && av !== 0 ? Math.round(((bv - av) / Math.abs(av)) * 1000) / 10 : null;
    const dir = dAbs == null ? 'flat' : dAbs > 0 ? 'up' : dAbs < 0 ? 'down' : 'flat';
    const good = dir !== 'flat' && (m.goodUp ? dir === 'up' : dir === 'down');
    const bad = dir !== 'flat' && (m.goodUp ? dir === 'down' : dir === 'up');
    return { ...m, av, bv, dAbs, dPct, dir, good, bad };
  }), [bMetrics, aMetrics, hasA]);

  // Итог словами: сколько метрик выросло/просело и что двигалось сильнее всего.
  const verdict = useMemo(() => {
    if (!hasA) return null;
    const moved = rows.filter(r => r.dPct != null && r.dPct !== 0);
    const better = rows.filter(r => r.good).length;
    const worse = rows.filter(r => r.bad).length;
    const byAbsPct = [...moved].sort((a, b) => Math.abs(b.dPct) - Math.abs(a.dPct));
    const topGood = byAbsPct.find(r => r.good) || null;
    const topBad = byAbsPct.find(r => r.bad) || null;
    return { better, worse, flat: rows.length - better - worse, topGood, topBad };
  }, [rows, hasA]);

  const periodPills = <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />;

  return (
    <>
      <PageHeader
        title={tt('⚖️ A/B точка')}
        sub={tt('Где были (замер A) → где сейчас (точка B). Замеры хранятся в компании, а не в браузере')}
      />

      {/* Контролы в ТЕЛЕ инструмента (не в топбаре) — иначе кнопка берёт устаревшее
          замыкание (loading/pointB момента монтирования) и «Зафиксировать» мертва. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, minWidth: 0 }}>
        <div style={{ minWidth: 0, maxWidth: '100%' }}>{periodPills}</div>
        {canEdit && (
          <>
            <button className="btn btn-sm btn-primary" onClick={capture} disabled={loading || saving || !pointB}>
              {tt('📌 Зафиксировать сейчас')}
            </button>
            <button className="btn btn-sm" onClick={openManual} disabled={loading || saving}>
              {tt('✎ Ввести замер вручную')}
            </button>
          </>
        )}
      </div>

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : !pointB ? (
        <EmptyState icon="⚖️" title={tt('Нет данных')} description={tt('Недостаточно данных за период')} />
      ) : (
        <>
          {legacy && (
            <Card style={{ marginBottom: 16, background: 'rgba(217,119,6,.07)', borderColor: 'rgba(217,119,6,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div style={{ flex: 1, minWidth: 180, fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800 }}>{tt('Найден старый замер в этом браузере')}</div>
                  <div style={{ color: 'var(--text2)' }}>
                    {tt('От')} {dateLabel(legacy.date)} — {tt('перенесите его в компанию, чтобы он не потерялся и был виден коллегам.')}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={importLegacy} disabled={saving}>{tt('Перенести')}</button>
              </div>
            </Card>
          )}

          {!hasA && (
            <Card style={{ marginBottom: 16, background: 'rgba(29,78,216,.06)', borderColor: 'rgba(29,78,216,.25)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>📌</span>
                <div style={{ flex: 1, minWidth: 180, fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800 }}>{tt('Замеров пока нет')}</div>
                  <div style={{ color: 'var(--text2)' }}>
                    {tt('Зафиксируйте сегодняшние метрики — через месяц вернётесь и увидите, что изменилось. Или введите вручную то, что было раньше.')}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Итог словами — что улучшилось, что просело */}
          {verdict && (
            <Card icon="🧭" title={tt('Что изменилось')} style={{ marginBottom: 16 }}>
              <div className="grid-3" style={{ marginBottom: verdict.topGood || verdict.topBad ? 12 : 0 }}>
                <Tile label={tt('Улучшилось')} value={`${verdict.better} ${tt('из')} ${rows.length}`} color="#16A34A" />
                <Tile label={tt('Просело')} value={`${verdict.worse} ${tt('из')} ${rows.length}`} color={verdict.worse ? '#DC2626' : 'var(--text2)'} />
                <Tile label={tt('Без изменений')} value={String(verdict.flat)} color="var(--text2)" />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {verdict.topGood && (
                  <Badge tone="green">
                    {tt('Сильнее всего вырос')}: {tt(verdict.topGood.label)} {verdict.topGood.dPct > 0 ? '+' : ''}{verdict.topGood.dPct}%
                  </Badge>
                )}
                {verdict.topBad && (
                  <Badge tone="red">
                    {tt('Главное падение')}: {tt(verdict.topBad.label)} {verdict.topBad.dPct > 0 ? '+' : ''}{verdict.topBad.dPct}%
                  </Badge>
                )}
              </div>
            </Card>
          )}

          {/* Замеры: какой берём за точку A */}
          <Card icon="🗂" title={`${tt('Замеры')} · ${snaps.length}`} style={{ marginBottom: 16 }}>
            {snaps.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', padding: '6px 0' }}>
                {tt('Ни одного замера. Нажмите «Зафиксировать сейчас» — это займёт секунду.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {snaps.map(s => {
                  const active = s.id === pickedId;
                  return (
                    <div key={s.id}
                      onClick={() => setPickedId(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer',
                        padding: '10px 12px', borderRadius: 10, minWidth: 0,
                        border: `1.5px solid ${active ? 'var(--primary, #1D4ED8)' : 'var(--border)'}`,
                        background: active ? 'rgba(29,78,216,.05)' : 'transparent',
                      }}>
                      <Badge tone={active ? 'blue' : 'gray'}>{active ? tt('точка A') : tt('выбрать')}</Badge>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.label || tt('Замер')}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                          {dateTimeLabel(s.captured_at)}
                          {s.author ? ` · ${s.author}` : ''}
                          {` · ${s.source === 'manual' ? tt('вручную') : tt('из данных')}`}
                          {s.note ? ` · ${s.note}` : ''}
                        </div>
                      </div>
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" title={tt('Удалить замер')}
                          onClick={(e) => { e.stopPropagation(); remove(s.id); }}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Две даты A/B */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Tile icon="🅰️" label={tt('Замер A')} value={hasA ? dateLabel(picked.captured_at) : tt('не выбран')}
              sub={hasA ? (picked.label || tt('снимок метрик')) : tt('зафиксируйте или введите вручную')} color="#94A0B5" />
            <Tile icon="🅱️" label={tt('Точка B (сейчас)')} value={dateLabel(pointB?.as_of)}
              sub={tt('текущие данные системы')} color="#1D4ED8" />
          </div>

          {/* KPI-хайлайты по категориям */}
          {GROUPS.map(g => (
            <Card key={g.key} icon={g.icon} title={tt(g.title)} style={{ marginBottom: 16 }}>
              <div className="grid-4">
                {g.metrics.map(m => {
                  const r = rows.find(x => x.key === m.key);
                  const delta = (hasA && r.dPct != null) ? (m.goodUp ? r.dPct : -r.dPct) : null;
                  return (
                    <Tile key={m.key} label={tt(m.label)}
                      value={fmtVal(m.type, r.bv)}
                      delta={delta}
                      sub={hasA ? `${tt('A')}: ${fmtVal(m.type, r.av)}` : tt('нет замера A')}
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
                    <th style={{ textAlign: 'right' }}>{tt('A')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({dateLabel(picked?.captured_at)})</span></th>
                    <th style={{ textAlign: 'right' }}>{tt('B')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({dateLabel(pointB?.as_of)})</span></th>
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
                        const deltaColor = !hasA ? 'var(--text3)' : r.good ? 'var(--green, #16A34A)' : r.bad ? 'var(--red, #DC2626)' : 'var(--text2)';
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
                                    <MiniLine a={r.av} b={r.bv} />
                                    <Badge tone={r.good ? 'green' : r.bad ? 'red' : 'gray'}>
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
            {tt('Замер — снимок метрик компании на дату. Точка B — сегодняшние данные системы. Δ % считается относительно выбранного замера. «Динамика» зелёная, если изменение к лучшему. Менеджер видит замеры только своего филиала.')}
          </div>
        </>
      )}

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title={tt('Замер вручную')} width={760}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
          {tt('Впишите цифры «как было» — например, до ремонта или до смены поставщика. Поля заполнены сегодняшними значениями: правьте только то, что знаете.')}
        </div>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <label className="label">{tt('Название замера')}</label>
            <input className="input" value={mLabel} maxLength={80}
              placeholder={tt('Например: до ремонта')} onChange={e => setMLabel(e.target.value)} />
          </div>
          <div style={{ minWidth: 0 }}>
            <label className="label">{tt('Дата замера')}</label>
            <input className="input" type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
          </div>
        </div>
        {GROUPS.map(g => (
          <div key={g.key} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: g.color, marginBottom: 8 }}>{g.icon} {tt(g.title)}</div>
            <div className="grid-4">
              {g.metrics.map(m => (
                <NumField key={m.key} label={tt(m.label)}
                  hint={m.type === 'pct' ? '%' : m.type === 'money' ? tt('сум') : tt('штук')}
                  value={mVals[m.key] ?? ''}
                  onChange={(v) => setMVals(s => ({ ...s, [m.key]: v }))} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label className="label">{tt('Комментарий')}</label>
          <input className="input" value={mNote} maxLength={300}
            placeholder={tt('Что происходило в этот момент')} onChange={e => setMNote(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setManualOpen(false)}>{tt('Отмена')}</button>
          <button className="btn btn-primary" onClick={saveManual} disabled={saving}>
            {saving ? tt('Сохранение…') : tt('Сохранить замер')}
          </button>
        </div>
      </Modal>
    </>
  );
}
