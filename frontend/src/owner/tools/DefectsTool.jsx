import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Progress, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Норма доли списаний от оборота — 1%.
const NORM_SHARE = 1;

export default function DefectsTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/writeoff-summary', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const lossAmount = data?.loss_amount || 0;
  const lossQty = data?.loss_qty || 0;
  const turnover = data?.turnover || 0;
  const sharePct = data?.share_pct || 0;
  const topReason = data?.top_reason || null;
  const journal = data?.journal || [];
  const reasons = data?.reasons || [];

  const shareOk = sharePct <= NORM_SHARE;
  const maxReason = Math.max(...reasons.map(r => r.amount || 0), 1);

  return (
    <>
      <PageHeader
        title={tt('🗑️ Брак и списание')}
        sub={tt('Потери склада за период · доля от оборота · топ-причина · журнал списаний')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={48} /></Card>)}
          </div>
          <Card><Skeleton height={200} /></Card>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Списано (штук)')} value={fmtNum(lossQty)} sub={tt('единиц за период')} color="#1D4ED8" />
            <Tile icon="💸" label={tt('Сумма потерь (сум)')} value={fmtMoneyFull(lossAmount)} sub={tt('себестоимость списаний')} color="#DC2626" />
            <Tile
              icon="📉"
              label={tt('Доля от оборота')}
              value={sharePct.toFixed(2) + '%'}
              sub={tt('норма до 1%')}
              color={shareOk ? '#16A34A' : '#DC2626'}
            />
            <Tile
              icon="⚠️"
              label={tt('Главная причина')}
              value={topReason ? tt(topReason.reason) : '—'}
              sub={topReason ? `${(topReason.share_pct || 0).toFixed(0)}% ${tt('случаев')}` : tt('нет списаний')}
              color="#D97706"
            />
          </div>

          <Card icon="🎯" title={tt('Контроль нормы')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 22, color: shareOk ? '#16A34A' : '#DC2626' }}>
                {sharePct.toFixed(2)}%
              </div>
              <Badge tone={shareOk ? 'green' : 'red'}>{shareOk ? tt('в норме') : tt('превышение')}</Badge>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {tt('Оборот за период')}: <b className="mono">{fmtMoneyFull(turnover)}</b> {tt('сум')}
              </div>
            </div>
            <Progress value={Math.min(sharePct, NORM_SHARE * 2)} max={NORM_SHARE * 2} color={shareOk ? '#16A34A' : '#DC2626'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginTop: 4 }}>
              <span>0%</span><span>{tt('норма')} 1%</span><span>2%+</span>
            </div>
          </Card>

          {reasons.length > 0 && (
            <Card icon="📊" title={tt('Причины списаний')} style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Причина')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма потери (сум)')}</th>
                    <th style={{ width: '30%' }}>{tt('Доля')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reasons.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{tt(r.reason)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.qty)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.amount)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}><Progress value={r.amount} max={maxReason} color="#D97706" /></div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', minWidth: 40, textAlign: 'right' }}>{(r.share_pct || 0).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card icon="📋" title={`${tt('Журнал списаний')} (${journal.length})`}>
            {journal.length === 0 ? (
              <EmptyState icon="📭" title={tt('Списаний за период нет')} description={tt('Брак и списания появятся здесь после операций на складе')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>{tt('Дата и время')}</th>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма потери (сум)')}</th>
                      <th>{tt('Причина')}</th>
                      <th>{tt('Кто списал')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.slice(0, 200).map(row => (
                      <tr key={row.id}>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {fmtDate(new Date(row.created_at), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang)}
                        </td>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(row.qty)} {row.unit}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{fmtMoneyFull(row.amount)}</td>
                        <td>{row.reason ? <Badge tone="orange">{tt(row.reason)}</Badge> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ color: 'var(--text2)' }}>{row.author || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
