import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Возвраты и причины: read-only по stock_outcome (outcome_type='return').
// Норма доли возвратов к продажам — 2%.
const NORM_PCT = 2;

const PERIODS = [
  { value: '7',   label: '7 дней' },
  { value: '30',  label: '30 дней' },
  { value: '90',  label: '90 дней' },
  { value: '365', label: 'Год' },
];

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return '—'; }
}

export default function ReturnsReportTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/operations/returns-report', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const kpi = data?.kpi || {};
  const rows = data?.rows || [];
  const reasons = data?.reasons || [];

  const pct = parseFloat(kpi.returns_pct || 0);
  const overNorm = pct > NORM_PCT;

  return (
    <>
      <PageHeader
        title={tt('↩️ Возвраты и причины')}
        sub={tt('Реестр возвратов · причины · доля к продажам (норма до 2%)')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔢" label={tt('Всего возвратов')} value={fmtNum(kpi.returns_count || 0)} sub={tt('за период')} color="#1D4ED8" />
            <Tile icon="💸" label={tt('Сумма возвратов')} value={`${fmtMoneyFull(kpi.returns_sum || 0)} UZS`} sub={tt('возвращено клиентам')} color="#DC2626" />
            <Tile
              icon="📉"
              label={tt('% от продаж')}
              value={`${pct.toFixed(1)}%`}
              sub={overNorm ? tt('выше нормы 2%') : tt('норма до 2%')}
              color={overNorm ? '#DC2626' : '#16A34A'}
            />
            <Tile icon="🏷️" label={tt('Главная причина')} value={kpi.top_reason ? tt(kpi.top_reason) : '—'} sub={kpi.top_reason_pct != null ? `${parseFloat(kpi.top_reason_pct).toFixed(0)}% ${tt('возвратов')}` : ''} color="#D97706" />
          </div>

          <Card icon="🏷️" title={tt('Причины возвратов')} style={{ marginBottom: 16 }}>
            {reasons.length === 0 ? (
              <div style={{ color: 'var(--text3)', padding: 14 }}>{tt('Кассир указывает причину при оформлении возврата (поле «причина»).')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Причина')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Доля')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reasons.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>{tt(r.reason || 'Без причины')}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.count)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.sum)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{parseFloat(r.pct || 0).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="📋" title={`${tt('Реестр возвратов')} (${rows.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата')}</th>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                    <th>{tt('Причина')}</th>
                    <th>{tt('Продавец')}</th>
                    <th>{tt('Клиент')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Возвратов нет')}</td></tr>
                  ) : rows.slice(0, 300).map((it, i) => (
                    <tr key={it.id || i}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(it.created_at)}</td>
                      <td style={{ fontWeight: 700 }}>{it.product_name || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.amount)}</td>
                      <td>{it.reason ? tt(it.reason) : <span style={{ color: 'var(--text3)' }}>{tt('Без причины')}</span>}</td>
                      <td>{it.seller || '—'}</td>
                      <td>{it.customer || <span style={{ color: 'var(--text3)' }}>{tt('Аноним')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
