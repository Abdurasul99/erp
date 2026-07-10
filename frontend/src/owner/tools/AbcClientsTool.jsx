import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// ABC-анализ клиентов (Парето 80/15/5).
// A — клиенты, дающие ~80% метрики (выручка/прибыль/частота), B — следующие ~15%, C — последние ~5%.
// Грейд назначается на бэкенде по накопительной доле. Метрика и период переключаются вживую.

const GRADE_META = {
  A: { color: '#16A34A', tone: 'green', label: 'A — ядро (≈80%)', desc: 'VIP — беречь, удерживать, растить' },
  B: { color: '#D97706', tone: 'amber', label: 'B — середина (≈15%)', desc: 'Развивать, поднимать средний чек' },
  C: { color: '#6B7280', tone: 'gray', label: 'C — хвост (≈5%)', desc: 'Автоматизировать, не тратить ресурс' },
};

const METRIC_OPTIONS = [
  { value: 'revenue', label: 'Выручка' },
  { value: 'profit', label: 'Прибыль' },
  { value: 'frequency', label: 'Частота' },
];

const PERIOD_OPTIONS = [
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
  { value: 'all', label: 'Всё время' },
];

export default function AbcClientsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('revenue');
  const [period, setPeriod] = useState('year');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period, metric };
    if (branchId) params.branch_id = branchId;
    api.get('/customers/abc', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period, metric]);

  const grades = data?.grades || {};
  const customers = data?.customers || [];
  const totalMetric = data?.total_metric || 0;

  // Метка единицы измерения метрики (для подписей).
  const metricUnit = metric === 'frequency' ? tt('покупок') : tt('сум');
  const fmtMetric = (v) => metric === 'frequency' ? fmtNum(v) : fmtMoney(v);

  // Доли A/B/C для stacked-бара (по выбранной метрике).
  const stack = useMemo(() => {
    return ['A', 'B', 'C'].map(g => {
      const gr = grades[g] || { metric_sum: 0 };
      const pct = totalMetric > 0 ? (gr.metric_sum / totalMetric) * 100 : 0;
      return { grade: g, pct, ...gr };
    });
  }, [grades, totalMetric]);

  const hasData = customers.length > 0;

  return (
    <>
      <PageHeader
        title={tt('🅰️ ABC клиентов')}
        sub={tt('Парето 80/15/5 — кто приносит основную ценность')}
        actions={<Badge tone="blue">{tt('Live')}</Badge>}
      />

      {/* Переключатели метрики и периода */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{tt('Метрика:')}</span>
            <Pills value={metric} onChange={setMetric} options={METRIC_OPTIONS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Метрика')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{tt('Период:')}</span>
            <Pills value={period} onChange={setPeriod} options={PERIOD_OPTIONS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Период')} />
          </div>
        </div>
      </Card>

      {error && <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState icon="🅰️" title={tt('Нет данных для ABC-анализа')}
            description={tt('За выбранный период не было покупок с привязкой к клиентам. Появятся продажи — анализ заработает.')} />
        </Card>
      ) : (
        <>
          {/* 3 карточки A / B / C */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            {['A', 'B', 'C'].map(g => {
              const gr = grades[g] || { count: 0, metric_sum: 0, avg_ltv: 0 };
              const meta = GRADE_META[g];
              const pct = totalMetric > 0 ? Math.round((gr.metric_sum / totalMetric) * 1000) / 10 : 0;
              return (
                <Tile key={g} icon={`🅰️`.replace('🅰️', '')}
                  label={tt(meta.label)}
                  value={`${fmtNum(gr.count)} ${tt('клиентов')}`}
                  sub={`${pct}% · ${fmtMetric(gr.metric_sum)} ${metricUnit} · LTV ${fmtMoney(gr.avg_ltv || 0)}`}
                  color={meta.color} />
              );
            })}
          </div>

          {/* Горизонтальный stacked-бар доли метрики */}
          <Card icon="📊" title={`${tt('Доля по метрике')}: ${tt(METRIC_OPTIONS.find(o => o.value === metric)?.label || '')}`} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', width: '100%', height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #E3EAF3)' }}>
              {stack.map(s => s.pct > 0 && (
                <div key={s.grade} title={`${s.grade}: ${s.pct.toFixed(1)}%`}
                  style={{
                    width: `${s.pct}%`, background: GRADE_META[s.grade].color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                  {s.pct >= 7 ? `${s.grade} ${s.pct.toFixed(0)}%` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {['A', 'B', 'C'].map(g => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: GRADE_META[g].color, display: 'inline-block' }} />
                  <strong>{g}</strong> — {tt(GRADE_META[g].desc)}
                </div>
              ))}
            </div>
          </Card>

          {/* Таблица клиентов */}
          <Card icon="📋" title={`${tt('Клиенты')} (${customers.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Клиент')}</th>
                    <th>{tt('Грейд')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Покупок/год')}</th>
                    <th style={{ textAlign: 'right' }}>{metric === 'profit' ? tt('Прибыль') : tt('Выручка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Доля')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Накопит.')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.slice(0, 300).map(c => {
                    const meta = GRADE_META[c.grade] || GRADE_META.C;
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name || tt('Без имени')}
                          {c.phone && <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>{c.phone}</span>}
                        </td>
                        <td><Badge tone={meta.tone}>{c.grade}</Badge></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.orders_year)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMetric(c.metric_value)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.pct}%</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{c.cum_pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {customers.length > 300 && (
              <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                {tt('Показаны первые 300 из')} {customers.length}
              </div>
            )}
          </Card>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('Грейд A — клиенты, дающие до 80% метрики; B — следующие 15%; C — последние 5%.')}
            {branchId ? ' (' + tt('выбранный филиал') + ')' : ' (' + tt('все филиалы') + ')'}
          </div>
        </>
      )}
    </>
  );
}
