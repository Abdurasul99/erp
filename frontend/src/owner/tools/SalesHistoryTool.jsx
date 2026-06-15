import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all',   label: 'Всё' },
];
const PM_LABEL = {
  cash: '💵 Нал', card: '💳 Карта', transfer: '🏦 Перевод', wire: '🏛 Перечисление', debt: '📋 В долг',
};
const PM_FILTERS = [
  { value: 'all', label: 'Все оплаты' },
  { value: 'cash', label: '💵 Нал' },
  { value: 'card', label: '💳 Карта' },
  { value: 'transfer', label: '🏦 Перевод' },
  { value: 'wire', label: '🏛 Перечисление' },
];
const TYPE_FILTERS = [
  { value: 'all', label: 'Все типы' },
  { value: 'b2c', label: '🛍 Розница' },
  { value: 'b2b', label: '🏢 B2B' },
];

function periodFrom(p) {
  const now = new Date();
  if (p === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (p === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (p === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString(); }
  return null;
}

export default function SalesHistoryTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [pm, setPm] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    const from = periodFrom(period);
    if (from) params.from = from;
    if (pm !== 'all') params.pm = pm;
    if (type !== 'all') params.type = type;
    if (search.trim()) params.search = search.trim();
    if (branchId) params.branch_id = branchId;
    api.get('/sales/history', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [period, pm, type, search, branchId]);

  const kpi = data?.kpi || {};
  const rows = data?.rows || [];

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <PageHeader
        title={tt('📋 История продаж')}
        sub={tt('Все продажи компании · реальные данные')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Период')} />}
      />

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🧾" label={tt('Чеков сегодня')} value={fmtNum(kpi.today_count || 0)} sub={`${fmtMoneyFull(kpi.today_sum || 0)} ${tt('сум')}`} color="#5B4FE8" />
        <Tile icon="💰" label={tt('Сумма за период')} value={fmtMoneyFull(kpi.period_sum || 0)} sub={tt('сум')} color="#22C55E" />
        <Tile icon="🧮" label={tt('Средний чек')} value={fmtMoneyFull(kpi.avg_check || 0)} sub={tt('сум')} color="#FF6B2B" />
        <Tile icon="🏢" label={tt('B2B доля')} value={(kpi.b2b_share || 0) + '%'} sub={`${fmtNum(kpi.b2b_count || 0)} ${tt('сделок')}`} color="#0EA5E9" />
      </div>

      {kpi.debt_count > 0 && (
        <Card style={{ marginBottom: 14, borderLeft: '4px solid var(--orange)' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            ⚠️ {fmtNum(kpi.debt_count)} {tt('продаж с непогашенным долгом — проверьте раздел')} «{tt('Долги клиентов')}»
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <input className="input" placeholder={tt('🔍 Товар, клиент или № продажи…')}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 240px', maxWidth: 360 }} aria-label={tt('Поиск по продажам')} />
          <Pills value={pm} onChange={setPm} options={PM_FILTERS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Способ оплаты')} />
          <Pills value={type} onChange={setType} options={TYPE_FILTERS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Тип продажи')} />
        </div>

        {loading && !data ? (
          <div>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={40} style={{ marginBottom: 8 }} />)}</div>
        ) : error ? (
          <div style={{ color: 'var(--red)', padding: 16, fontWeight: 600 }}>⚠️ {error}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🧾" title={tt('Продаж не найдено')}
            description={tt('За выбранный период и фильтры продаж нет. Измените период или сбросьте фильтры.')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{tt('Дата')}</th>
                  <th>{tt('Товар')}</th>
                  <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                  <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                  <th>{tt('Оплата')}</th>
                  <th>{tt('Клиент')}</th>
                  <th>{tt('Тип')}</th>
                  <th>{tt('Филиал')}</th>
                  <th>{tt('Продавец')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ color: 'var(--text3)' }}>#{s.id}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                    <td style={{ fontWeight: 600 }}>{s.product}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.qty)} {s.unit}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.total)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {PM_LABEL[s.pm] ? tt(PM_LABEL[s.pm]) : s.pm}
                      {s.payment_status !== 'paid' && <Badge tone="orange">{tt('долг')}</Badge>}
                    </td>
                    <td>{s.customer || <span style={{ color: 'var(--text3)' }}>{tt('розница')}</span>}</td>
                    <td><Badge tone={s.type === 'B2B' ? 'purple' : 'blue'}>{s.type}</Badge></td>
                    <td style={{ color: 'var(--text2)' }}>{s.branch || '—'}</td>
                    <td style={{ color: 'var(--text2)' }}>{s.seller || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length >= 300 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                {tt('Показаны последние 300 продаж. Уточните период или фильтры для более точного среза.')}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
