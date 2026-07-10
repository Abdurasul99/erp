import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Статусы приёмки → бейдж + иконка.
const STATUS_META = {
  full:  { tone: 'green',  icon: '✅', label: 'Полная' },
  diff:  { tone: 'orange', icon: '⚠', label: 'Расхождение' },
  defect:{ tone: 'red',    icon: '🛑', label: 'Брак' },
};

export default function ReceivingsTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [selected, setSelected] = useState(null); // детали приёмки (receiving_items)

  useEffect(() => {
    setLoading(true); setError(null); setSelected(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/receivings', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const openDetails = (id) => {
    setSelected({ id, loading: true, items: [], notes: [] });
    api.get(`/procurement/receivings/${id}`)
      .then(r => setSelected({ id, loading: false, ...r.data }))
      .catch(e => setSelected({ id, loading: false, error: e.response?.data?.error || e.message, items: [], notes: [] }));
  };

  const kpi = data?.kpi || {};
  const list = data?.receivings || [];

  const fmtDt = (v) => v ? fmtDate(new Date(v), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang) : '—';

  return (
    <>
      <PageHeader
        title={tt('📦 Приёмка товара')}
        sub={tt('Приёмки по накладным · расхождения · брак')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="✅" label={tt('Приёмок выполнено')} value={fmtNum(kpi.count || 0)} sub={tt('за период')} color="var(--primary)" />
            <Tile icon="💰" label={tt('Принято товара (сум)')} value={fmtMoneyFull(kpi.total_amount || 0)} sub={tt('сумма приёмок')} color="#16A34A" />
            <Tile icon="⚠" label={tt('Расхождений')} value={fmtNum(kpi.diff_count || 0)} sub={tt('недосчёт/пересчёт')} color="#D97706" />
            <Tile icon="🛑" label={tt('Брака при приёмке')} value={fmtNum(kpi.defect_qty || 0)} sub={tt('единиц брака')} color="#DC2626" />
          </div>

          <Card icon="📋" title={`${tt('История приёмок')} (${list.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>{tt('№ накладной')}</th>
                    <th>{tt('Дата и время')}</th>
                    <th>{tt('Поставщик')}</th>
                    <th>{tt('Заказ №')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Позиций')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус приёмки')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет приёмок за период')}</td></tr>
                  ) : list.map(r => {
                    const meta = STATUS_META[r.status] || STATUS_META.full;
                    return (
                      <tr key={r.id} onClick={() => openDetails(r.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 700 }}>{r.invoice_no || `#${r.id}`}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDt(r.created_at)}</td>
                        <td>{r.supplier_name || '—'}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{r.order_id ? `№${r.order_id}` : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.items_count || 0)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.total_amount || 0)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge tone={meta.tone}>{meta.icon} {tt(meta.label)}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {selected && (
            <Card icon="🔍" title={`${tt('Позиции приёмки')} ${selected.invoice_no || '#' + selected.id}`} style={{ marginBottom: 16 }}
              actions={<button type="button" className="pill" onClick={() => setSelected(null)}>{tt('Закрыть')}</button>}>
              {selected.loading ? (
                <div style={{ color: 'var(--text3)', padding: 20 }}>{tt('Загрузка...')}</div>
              ) : selected.error ? (
                <div style={{ color: 'var(--red)' }}>{selected.error}</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th>{tt('Товар')}</th>
                          <th style={{ textAlign: 'right' }}>{tt('Заказано (шт)')}</th>
                          <th style={{ textAlign: 'right' }}>{tt('Принято (шт)')}</th>
                          <th style={{ textAlign: 'right' }}>{tt('Разница')}</th>
                          <th>{tt('Состояние')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.items || []).length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>{tt('Нет позиций')}</td></tr>
                        ) : selected.items.map(it => {
                          const diff = it.diff != null ? it.diff : (it.received_qty || 0) - (it.ordered_qty || 0);
                          const cond = diff === 0 ? tt('OK') : diff < 0 ? tt('Недосчёт') : tt('Пересчёт');
                          const col = diff === 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#D97706';
                          return (
                            <tr key={it.id}>
                              <td style={{ fontWeight: 700 }}>{it.product_name || `#${it.product_id}`}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.ordered_qty || 0)}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.received_qty || 0)}</td>
                              <td className="mono" style={{ textAlign: 'right', color: col, fontWeight: 700 }}>{diff > 0 ? '+' : ''}{fmtNum(diff)}</td>
                              <td style={{ color: col, fontWeight: 700, fontSize: 12 }}>{cond}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(selected.notes || []).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{tt('⚠ Замечания при приёмке')}</div>
                      {selected.notes.map((n, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <b>{n.product_name || '—'}:</b> {n.note}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
