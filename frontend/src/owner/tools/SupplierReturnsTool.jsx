import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const STATUS_META = {
  compensated: { label: '✅ Компенсировано', tone: 'green' },
  open:        { label: '⏳ В работе',        tone: 'amber' },
};

const fmtDt = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function SupplierReturnsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/returns', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (id, status) => {
    api.patch(`/procurement/returns/${id}`, { status, compensation_type: status === 'compensated' ? 'refund' : null })
      .then(() => load())
      .catch(e => setError(e.response?.data?.error || e.message));
  };

  const summary = data?.summary || { count: 0, total: 0, compensated: 0, in_progress: 0 };
  const items = data?.items || [];
  const bySupplier = data?.by_supplier || [];

  return (
    <>
      <PageHeader
        title={tt('↩️ Возвраты поставщику')}
        sub={tt('Брак · недопоставка · компенсации от поставщиков')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Возвратов оформлено')} value={fmtNum(summary.count)} sub={tt('за период')} color="var(--primary)" />
            <Tile icon="💰" label={tt('Сумма возвратов (сум)')} value={fmtMoneyFull(summary.total)} color="#1D4ED8" />
            <Tile icon="✅" label={tt('Компенсировано (сум)')} value={fmtMoneyFull(summary.compensated)} color="#16A34A" />
            <Tile icon="⏳" label={tt('В процессе (сум)')} value={fmtMoneyFull(summary.in_progress)} color="#D97706" />
          </div>

          <Card icon="📋" title={`${tt('Возвраты')} (${items.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата и время')}</th>
                    <th>{tt('Поставщик')}</th>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    <th>{tt('Причина')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет возвратов за период')}</td></tr>
                  ) : items.map(it => {
                    const meta = STATUS_META[it.status] || STATUS_META.open;
                    return (
                      <tr key={it.id}>
                        <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDt(it.created_at)}</td>
                        <td style={{ fontWeight: 700 }}>{it.supplier_name || '—'}</td>
                        <td>{it.product_name || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.qty)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.amount)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{it.reason || '—'}</td>
                        <td style={{ textAlign: 'center' }}><Badge tone={meta.tone}>{tt(meta.label)}</Badge></td>
                        <td style={{ textAlign: 'right' }}>
                          {it.status !== 'compensated' && (
                            <button className="btn-sm" type="button" onClick={() => setStatus(it.id, 'compensated')}
                              style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}>
                              {tt('Компенсировано')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🏭" title={tt('По поставщикам')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Возвратов')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('% от закупок')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bySupplier.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет данных')}</td></tr>
                  ) : bySupplier.map(s => (
                    <tr key={s.supplier_id || s.supplier_name}>
                      <td style={{ fontWeight: 700 }}>{s.supplier_name || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.count)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.amount)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{s.return_rate == null ? '—' : Number(s.return_rate).toFixed(1) + '%'}</td>
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
