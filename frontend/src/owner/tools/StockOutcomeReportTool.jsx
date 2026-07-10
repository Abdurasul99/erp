import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, EmptyState, SkeletonCard, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const TYPE_TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'sale',     label: 'Продажа' },
  { value: 'writeoff', label: 'Брак / Списание' },
  { value: 'return',   label: 'Перемещение' },
];

const TYPE_META = {
  sale:     { label: 'Продажа',         tone: 'green', color: '#16A34A' },
  writeoff: { label: 'Брак / Списание', tone: 'red',   color: '#DC2626' },
  return:   { label: 'Перемещение',     tone: 'blue',  color: '#1D4ED8' },
};

export default function StockOutcomeReportTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [typeTab, setTypeTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/outcome-summary', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const kpi = data?.kpi || {};
  const rows = data?.rows || [];
  const filtered = typeTab === 'all' ? rows : rows.filter(r => r.outcome_type === typeTab);

  return (
    <>
      <PageHeader
        title={tt('📤 Расход товара')}
        sub={tt('Продажи · списания брака · перемещения за период')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          <Card icon="📊" title={tt('Итого за период')} style={{ marginBottom: 16 }}
            actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}>
            <div className="grid-4">
              <Tile icon="🛒" label={tt('Продано (штук)')}
                value={fmtNum(kpi.sold_qty || 0)} sub={tt('реализовано через кассу')} color="#16A34A" />
              <Tile icon="💰" label={tt('Себестоимость проданного (сум)')}
                value={fmtMoneyFull(kpi.sold_cost || 0)} sub={tt('сумма закупочных цен')} color="#1D4ED8" />
              <Tile icon="🗑️" label={tt('Списано бракованных (шт)')}
                value={fmtNum(kpi.writeoff_qty || 0)} sub={tt('объём брака')} color="#DC2626" />
              <Tile icon="🔁" label={tt('Перемещено (шт)')}
                value={fmtNum(kpi.transfer_qty || 0)} sub={tt('в другой филиал')} color="#D97706" />
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Все расходы за период')} (${filtered.length})`}
            actions={<Pills value={typeTab} onChange={setTypeTab} options={TYPE_TABS.map(t => ({ ...t, label: tt(t.label) }))} />}>
            {filtered.length === 0 ? (
              <EmptyState icon="📭" title={tt('Нет операций')} description={tt('За выбранный период расходов нет')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата и время')}</th>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Закупочная цена за шт (сум)')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Тип расхода')}</th>
                      <th>{tt('Источник')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map(r => {
                      const meta = TYPE_META[r.outcome_type] || { label: r.outcome_type, tone: 'gray', color: 'var(--text2)' };
                      return (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {fmtDate(new Date(r.created_at), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang)}
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.quantity)} {r.unit}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.price_buy)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                              {tt(meta.label)}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text2)', fontSize: 12 }}>{r.source || '—'}</td>
                        </tr>
                      );
                    })}
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
