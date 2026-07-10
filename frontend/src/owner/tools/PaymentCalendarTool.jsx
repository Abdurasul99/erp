import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, AreaChart, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt, fmtDate } from '../tt.js';

// Платёжный календарь — прогноз остатка кассы на 14 дней + список платежей.
// Источник: неоплаченные stock_income (исходящие), дебиторка stock_outcome (входящие),
// стартовый баланс — из кассовой логики. Алертит даты ниже минимального уровня (кассовый разрыв).
export default function PaymentCalendarTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { days: 14 };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/payment-calendar', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const d = data || {};
  const days = d.days || [];
  const payments = d.payments || [];
  const alerts = d.alerts || [];

  // День «дд.мм» для подписей
  const dm = (iso) => fmtDate(new Date(iso + 'T00:00:00'), { day: 'numeric', month: 'short' }, lang);

  // Серия остатка для графика + подписи (каждый ~3-й день)
  const chartData = days.map(x => x.balance);
  const chartLabels = days.map((x, i) => (i % 3 === 0 || i === days.length - 1) ? dm(x.day) : '');

  const hasAny = payments.length > 0 || (d.starting_balance != null);

  return (
    <>
      <PageHeader title={'📅 ' + tt('Платёжный календарь')} sub={tt('Все входящие и исходящие платежи по датам · следующие 14 дней')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasAny ? (
        <Card><EmptyState icon="📅" title={tt('Нет запланированных платежей')} description={tt('На ближайшие 14 дней нет ни долгов поставщикам, ни ожидаемых поступлений от клиентов.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Баланс кассы сейчас')} value={fmtMoneyFull(d.starting_balance)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon="📥" label={tt('Ожидаемые поступления')} value={fmtMoneyFull(d.total_incoming)} sub={tt('сум · от клиентов')} color="#16A34A" />
            <Tile icon="📤" label={tt('Платежи поставщикам')} value={fmtMoneyFull(d.total_outgoing)} sub={tt('сум · долги')} color="#D97706" />
            <Tile icon="🏁" label={tt('Прогноз остатка через 14 дней')} value={fmtMoneyFull(d.ending_balance)} sub={tt('сум')} color={d.ending_balance < 0 ? '#DC2626' : '#0EA5E9'} />
          </div>

          {alerts.length > 0 && (
            <Card style={{ marginBottom: 16, borderColor: 'var(--orange)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--orange)', marginBottom: 8 }}>
                ⚠️ {tt('Риск кассового разрыва')}
              </div>
              {alerts.map((a, i) => (
                <div key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)', marginBottom: i < alerts.length - 1 ? 8 : 0 }}>
                  <strong>{dm(a.day)}:</strong>{' '}
                  {tt('после платежей остаток упадёт до')}{' '}
                  <strong className="mono" style={{ color: 'var(--red)' }}>{fmtMoneyFull(a.balance)}</strong> {tt('сум.')}
                  {' '}{tt('Убедитесь, что к этой дате накопится достаточно выручки.')}
                </div>
              ))}
            </Card>
          )}

          <Card icon="📈" title={tt('Прогноз остатка кассы · следующие 14 дней')} style={{ marginBottom: 16 }}>
            {chartData.length > 0 ? (
              <AreaChart data={chartData} labels={chartLabels} color={d.ending_balance < 0 ? '#DC2626' : '#1D4ED8'} height={180} />
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных за период')}</div>
            )}
          </Card>

          <Card icon="📋" title={tt('Все платежи · ближайшие 14 дней')}>
            {payments.length === 0 ? (
              <EmptyState icon="📭" title={tt('Платежей нет')} description={tt('На ближайшие 14 дней платежей не запланировано.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{tt('Дата')}</th>
                      <th>{tt('Тип')}</th>
                      <th>{tt('Описание')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Остаток после (сум)')}</th>
                      <th>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => {
                      const incoming = p.direction === 'in';
                      return (
                        <tr key={i}>
                          <td className="mono">{dm(p.day)}</td>
                          <td>
                            <Badge tone={incoming ? 'green' : 'yellow'}>
                              {incoming ? tt('Приход') : tt('Расход')}
                            </Badge>
                          </td>
                          <td>{p.title}</td>
                          <td className="mono" style={{ textAlign: 'right', color: incoming ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                            {incoming ? '+' : '−'}{fmtMoneyFull(p.amount)}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: p.balance_after < 0 ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>
                            {fmtMoneyFull(p.balance_after)}
                          </td>
                          <td>{incoming ? '⏰ ' + tt('Ожидается') : '⏰ ' + tt('Запланировано')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <AiAnalyze topic="payment-calendar" branchId={branchId} />
        </>
      )}
    </>
  );
}
