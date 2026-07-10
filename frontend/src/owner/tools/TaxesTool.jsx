import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Pills, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt, fmtDate } from '../tt.js';

const CUR_YEAR = new Date().getFullYear();

export default function TaxesTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [year, setYear] = useState(CUR_YEAR);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(null);

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { year };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/taxes', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [year, branchId]);

  useEffect(() => load(), [load]);

  const markPaid = async (id) => {
    setPaying(id);
    try {
      await api.patch(`/finance/taxes/${id}/pay`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setPaying(null);
    }
  };

  const d = data || {};
  const next = d.next_payment;
  const yearOpts = [CUR_YEAR - 2, CUR_YEAR - 1, CUR_YEAR].map(y => ({ value: y, label: String(y) }));
  const fmtD = (s) => s ? fmtDate(new Date(s), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang) : '—';

  return (
    <>
      <PageHeader
        title={'🏛️ ' + tt('Налоги')}
        sub={tt('Учёт налогов · расчёт от выручки · история платежей')}
        actions={<Pills value={year} onChange={setYear} options={yearOpts} label={tt('Год')} />}
      />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="✅" label={tt('Уплачено за год')} value={fmtMoneyFull(d.paid_total)} sub={tt('сум')} color="#16A34A" />
            <Tile icon="📅" label={tt('Следующий платёж')}
              value={next ? fmtD(next.due_date) : '—'}
              sub={next ? fmtMoneyFull(next.amount) + ' ' + tt('сум') : tt('нет начислений')} color="#1D4ED8" />
            <Tile icon="📊" label={tt('Налоговая нагрузка')} value={(d.tax_burden_pct ?? 0) + '%'} sub={tt('от выручки')} color="#D97706" />
            <Tile icon="🧾" label={tt('Режим')} value={tt(d.regime_label || 'Упрощёнка')} sub={d.rate_pct + '% ' + tt('от оборота')} color="#0EA5E9" />
          </div>

          {next && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)' }}>
                  {tt('Следующий платёж по сроку до')}{' '}
                  <strong>{fmtD(next.due_date)}</strong>{' — '}
                  <strong className="mono" style={{ color: 'var(--primary)' }}>{fmtMoneyFull(next.amount)}</strong> {tt('сум')}
                  {' '}({tt('период')} {next.period}).
                </div>
                <button className="btn btn-primary" disabled={paying === next.id} onClick={() => markPaid(next.id)}>
                  {paying === next.id ? tt('Сохраняю…') : '✅ ' + tt('Отметить уплаченным')}
                </button>
              </div>
            </Card>
          )}

          <Card icon="🧾" title={tt('История платежей')}>
            {(!d.payments || d.payments.length === 0) ? (
              <EmptyState icon="🧾" title={tt('Нет налоговых платежей')}
                description={tt('За выбранный год начислений нет. Появится выручка — расчёт заработает.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{tt('Срок')}</th>
                      <th>{tt('Период')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('База')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Ставка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                      <th>{tt('Статус')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.payments.map(p => (
                      <tr key={p.id}>
                        <td>{fmtD(p.due_date)}</td>
                        <td>{p.period}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(p.base_amount)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{p.rate_pct}%</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(p.amount)}</td>
                        <td>
                          <Badge tone={p.status === 'paid' ? 'green' : 'yellow'}>
                            {p.status === 'paid' ? tt('Уплачен') : tt('Предстоит')}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {p.status !== 'paid' && (
                            <button className="btn btn-sm" disabled={paying === p.id} onClick={() => markPaid(p.id)}>
                              {paying === p.id ? '…' : tt('Оплатить')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🧮" title={tt('Как это считается')}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div>{tt('Налог = Выручка (одобренные продажи) × Ставка режима')}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {tt('По умолчанию — упрощёнка 4% от оборота. База берётся из одобренных продаж за период.')}
              </div>
            </div>
          </Card>

          <AiAnalyze topic="taxes" branchId={branchId} />
        </>
      )}
    </>
  );
}
