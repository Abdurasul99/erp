import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, BarChart, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

export default function PurchaseHistoryTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/history', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const summary = data?.summary || { total: 0, invoices: 0, suppliers: 0, items: 0 };
  const rows = data?.rows || [];
  const chart = data?.chart || [];
  const bySupplier = data?.by_supplier || [];

  return (
    <>
      <PageHeader
        title={tt('📜 История закупок')}
        sub={tt('Закупки · Менеджер · только просмотр')}
        actions={<Badge tone="yellow">{tt('🟡 Полезно')}</Badge>}
      />

      <div style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Закуплено (сум)')} value={fmtMoneyFull(summary.total)} sub={tt('за период')} color="var(--primary)" />
            <Tile icon="🧾" label={tt('Накладных')} value={fmtNum(summary.invoices)} sub={tt('приходов')} color="#1D4ED8" />
            <Tile icon="🤝" label={tt('Поставщиков')} value={fmtNum(summary.suppliers)} sub={tt('активных')} color="#16A34A" />
            <Tile icon="📦" label={tt('Позиций товара')} value={fmtNum(summary.items)} sub={tt('штук закуплено')} color="#D97706" />
          </div>

          <Card icon="📈" title={tt('Динамика закупок по месяцам')} style={{ marginBottom: 16 }}>
            <BarChart
              data={chart.map(c => c.total)}
              labels={chart.map(c => c.label)}
              color="var(--primary)"
              height={180}
            />
          </Card>

          <Card icon="📊" title={tt('Закупки по поставщикам')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Закуплено (сум)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Доля')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Накладных')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний чек (сум)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bySupplier.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет данных')}</td></tr>
                  ) : bySupplier.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{s.supplier || tt('Без поставщика')}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.total)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        <span style={{ background: 'rgba(29,78,216,.10)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 800, fontSize: 12 }}>
                          {(s.share || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.invoices)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoneyFull(s.avg_check)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Все закупки за период')} (${rows.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата и время')}</th>
                    <th>{tt('Накладная')}</th>
                    <th>{tt('Поставщик')}</th>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Цена/шт (сум)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Итого (сум)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет закупок за период')}</td></tr>
                  ) : rows.slice(0, 500).map(r => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }} className="mono">
                        {fmtDate(new Date(r.created_at), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang)}
                      </td>
                      <td className="mono" style={{ color: 'var(--text2)' }}>#{r.id}</td>
                      <td style={{ fontWeight: 600 }}>{r.supplier || tt('Без поставщика')}</td>
                      <td>{r.product_name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.quantity)} {r.unit || ''}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(r.price)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.total)}</td>
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
