import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtMoney, fmtNum, EmptyState } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Цвет ячейки ретеншна по значению (%): тепловая карта зелёный→красный.
function retColor(v) {
  if (v == null) return 'transparent';
  if (v >= 70) return 'rgba(22,163,74,.85)';
  if (v >= 50) return 'rgba(34,197,94,.65)';
  if (v >= 35) return 'rgba(245,158,11,.55)';
  if (v >= 20) return 'rgba(249,115,22,.55)';
  return 'rgba(239,68,68,.60)';
}
const retText = (v) => (v >= 50 ? '#fff' : 'var(--text)');

function fmtMonth(d, tt) {
  if (!d) return '—';
  const dt = new Date(d);
  const M = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${tt(M[dt.getMonth()])} ${dt.getFullYear()}`;
}

export default function CohortsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { months };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/cohorts', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, months]);

  const summary = data?.summary || {};
  const cohorts = data?.cohorts || [];
  const curve = data?.curve || [];
  const cols = Array.from({ length: months + 1 }, (_, n) => n); // 0..months

  const pct = (v) => (v == null ? '—' : `${v}%`);
  const monthOpts = [3, 6, 9, 12].map(m => ({ value: m, label: `${m} ${tt('мес')}` }));

  const curveMax = 100;

  return (
    <>
      <PageHeader
        title={tt('📊 Когортный анализ')}
        sub={tt('Клиенты по месяцу первой покупки · % вернувшихся · LTV')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pills value={months} onChange={setMonths} options={monthOpts} label={tt('Глубина')} />
            <Badge tone="green">{tt('Live')}</Badge>
          </div>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : cohorts.length === 0 ? (
        <EmptyState icon="📊" title={tt('Нет данных по когортам')}
          description={tt('Когорты появятся, когда у клиентов будут привязанные продажи. Источник — одобренные продажи с клиентом.')} />
      ) : (
        <>
          {/* Сводка ретеншна */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔁" label={tt('Ретеншн 1 мес')} value={pct(summary.ret_1m)} color="#16a34a"
              sub={tt('средн. по когортам')} />
            <Tile icon="📉" label={tt('Ретеншн 3 мес')} value={pct(summary.ret_3m)} color="#D97706" />
            <Tile icon="⏳" label={tt('Ретеншн 6 мес')} value={pct(summary.ret_6m)} color="#DC2626" />
            <Tile icon="🏆" label={tt('Лучшая когорта')}
              value={summary.best_cohort ? fmtMonth(summary.best_cohort.cohort_month, tt) : '—'}
              sub={summary.best_cohort ? `${summary.best_cohort.retention_6m}% ${tt('на 6 мес')}` : tt('недостаточно данных')}
              color="#1D4ED8" />
          </div>

          {/* Критический провал */}
          {summary.critical_dropoff && (
            <Card style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,.30)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <b>{tt('Критический отток')}: </b>
                  {tt('провал между')} {tt('мес')} {summary.critical_dropoff.from_month} → {summary.critical_dropoff.to_month}:
                  {' '}{summary.critical_dropoff.from}% → {summary.critical_dropoff.to}%
                  {' '}<Badge tone="red">−{summary.critical_dropoff.drop}%</Badge>
                  <div style={{ color: 'var(--text2)', marginTop: 2 }}>
                    {tt('Здесь клиенты чаще всего перестают возвращаться — усильте удержание к этому месяцу.')}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Кривая удержания (усреднённая) */}
          <Card icon="📈" title={tt('Кривая удержания — средняя по когортам')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '8px 0' }}>
              {curve.map(p => {
                const h = p.retention == null ? 0 : Math.max(2, (p.retention / curveMax) * 120);
                return (
                  <div key={p.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)' }}>
                      {p.retention == null ? '—' : `${p.retention}%`}
                    </div>
                    <div style={{
                      width: '70%', height: h, borderRadius: '4px 4px 0 0',
                      background: retColor(p.retention == null ? 0 : p.retention),
                      transition: 'height .3s',
                    }} />
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{tt('м')}{p.month}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Тепловая карта когорт */}
          <Card icon="🗓️" title={tt('Когорты — % вернувшихся клиентов')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Когорта')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Новых')}</th>
                    {cols.map(n => <th key={n} style={{ textAlign: 'center' }}>{tt('м')}{n}</th>)}
                    <th style={{ textAlign: 'right' }}>{tt('LTV')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map(c => (
                    <tr key={c.cohort_month}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMonth(c.cohort_month, tt)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(c.cohort_size)}</td>
                      {cols.map(n => {
                        const v = c.retention[n] != null ? parseFloat(c.retention[n]) : null;
                        return (
                          <td key={n} style={{
                            textAlign: 'center',
                            fontSize: 11.5, fontWeight: 700,
                            background: retColor(v), color: v == null ? 'var(--text3)' : retText(v),
                            borderRadius: 4,
                          }}>{v == null ? '·' : `${v}%`}</td>
                        );
                      })}
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span><b>{tt('м0')}</b> = {tt('месяц первой покупки (100%)')}</span>
              <span>{tt('мN — % клиентов когорты с покупкой через N месяцев')}</span>
              <span>· {tt('Когорт')}: {fmtNum(summary.cohort_count)} · {tt('Клиентов')}: {fmtNum(summary.total_customers)}</span>
            </div>
          </Card>
        </>
      )}
    </>
  );
}