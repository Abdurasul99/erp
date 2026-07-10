import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Pills, AreaChart, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

// Прогноз кассового разрыва на 30/60/90 дней.
// Backend: GET /api/finance/cash-gap?horizon=&scenario=&branch_id=
// Опирается на платёжный календарь (дебиторка/кредиторка) и cashflow (стартовый баланс).
// Сценарий: база / пессим (приходы −20%, расходы +10%) / оптим (приходы +10%, расходы −10%).

const HORIZONS = [
  { value: 30, label: '30 дн' },
  { value: 60, label: '60 дн' },
  { value: 90, label: '90 дн' },
];
const SCENARIOS = [
  { value: 'base',  label: 'База' },
  { value: 'pessimistic', label: 'Пессим' },
  { value: 'optimistic',  label: 'Оптим' },
];

export default function CashGapTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [horizon, setHorizon] = useState(30);
  const [scenario, setScenario] = useState('base');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { horizon, scenario };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/cash-gap', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, horizon, scenario]);

  const fmtDay = (iso) => {
    if (!iso) return '—';
    try { return fmtDate(new Date(iso), { day: 'numeric', month: 'short' }, lang); }
    catch { return iso; }
  };

  const days = data?.days || [];
  const hasData = days.length > 0;
  const series = days.map(d => Math.round(d.balance || 0));
  const firstGap = data?.first_gap || null;        // { day, in_days }
  const peak = data?.peak_deficit || null;         // { day, amount }
  const injection = Math.round(data?.required_injection || 0);
  const startBalance = Math.round(data?.starting_balance || 0);
  const endBalance = Math.round(data?.ending_balance || 0);

  // Метки осей X — первая / середина / последняя дата
  const labels = hasData
    ? days.map((d, i) => (i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2)) ? fmtDay(d.day) : '')
    : [];

  // Заливка чарта: красная, если в горизонте есть разрыв.
  const chartColor = firstGap ? '#DC2626' : '#16A34A';

  return (
    <>
      <PageHeader
        title={tt('📉 Прогноз кассового разрыва')}
        sub={tt('Когда деньги в кассе уйдут в минус — и сколько нужно «подкинуть»')}
        actions={<Badge tone={firstGap ? 'red' : 'green'}>{firstGap ? tt('Есть риск') : tt('Разрывов нет')}</Badge>}
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{tt('Горизонт:')}</span>
            <Pills value={horizon} onChange={setHorizon}
              options={HORIZONS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Горизонт прогноза')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{tt('Сценарий:')}</span>
            <Pills value={scenario} onChange={setScenario}
              options={SCENARIOS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Сценарий прогноза')} />
          </div>
        </div>
      </Card>

      {error && <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState icon="📉" title={tt('Недостаточно данных для прогноза')}
            description={tt('Нет запланированных платежей и поступлений в этом горизонте — кассовый разрыв спрогнозировать не на чём. Появятся долги клиентов и поставщиков со сроками — прогноз заработает.')} />
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏦" label={tt('Текущий баланс кассы')} value={fmtMoneyFull(startBalance)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon={firstGap ? '🚨' : '✅'} label={tt('Первый разрыв')}
              value={firstGap ? `${tt('через')} ${firstGap.in_days} ${tt('дн')}` : tt('нет')}
              sub={firstGap ? fmtDay(firstGap.day) : tt('касса в плюсе')}
              color={firstGap ? '#DC2626' : '#16A34A'} />
            <Tile icon="📉" label={tt('Пиковый дефицит')}
              value={peak ? fmtMoneyFull(Math.abs(peak.amount)) : '0'}
              sub={peak ? fmtDay(peak.day) : tt('дефицита нет')}
              color={peak ? '#DC2626' : '#16A34A'} />
            <Tile icon="💉" label={tt('Нужная инъекция')}
              value={injection > 0 ? fmtMoneyFull(injection) : '0'}
              sub={injection > 0 ? tt('чтобы не уйти в минус') : tt('не требуется')}
              color={injection > 0 ? '#D97706' : '#16A34A'} />
          </div>

          {/* Area-чарт дневного баланса */}
          <Card icon="📈" title={tt('Прогноз баланса кассы по дням')}
            actions={<Badge tone="blue">{tt('Конец горизонта:')} {fmtMoneyFull(endBalance)}</Badge>}
            style={{ marginBottom: 16 }}>
            <AreaChart data={series} labels={labels} color={chartColor} height={200} />
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              {firstGap ? (
                <>
                  <strong style={{ color: 'var(--red)' }}>⚠️ {tt('Внимание:')}</strong>{' '}
                  {tt('баланс уходит ниже нуля')} <strong>{fmtDay(firstGap.day)}</strong>{' '}
                  ({tt('через')} {firstGap.in_days} {tt('дн')}).{' '}
                  {injection > 0 && <>{tt('Чтобы избежать разрыва, потребуется до')}{' '}
                    <strong className="mono">{fmtMoneyFull(injection)} {tt('сум')}</strong>.</>}
                </>
              ) : (
                <><strong style={{ color: 'var(--green)' }}>✅ {tt('Хорошо:')}</strong>{' '}
                  {tt('в горизонте')} {horizon} {tt('дн касса остаётся положительной.')}</>
              )}
            </div>
          </Card>

          {/* Таблица по дням */}
          <Card icon="📋" title={tt('Движение денег по дням')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Приток')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Отток')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Нетто')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Баланс')}</th>
                    <th>{tt('События')}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const inflow = Math.round(d.inflow || 0);
                    const outflow = Math.round(d.outflow || 0);
                    const net = inflow - outflow;
                    const bal = Math.round(d.balance || 0);
                    const isMove = inflow > 0 || outflow > 0;
                    return (
                      <tr key={i} style={{ opacity: isMove ? 1 : 0.55 }}>
                        <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDay(d.day)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: inflow > 0 ? 'var(--green)' : 'var(--text3)' }}>
                          {inflow > 0 ? '+' + fmtMoneyFull(inflow) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: outflow > 0 ? 'var(--red)' : 'var(--text3)' }}>
                          {outflow > 0 ? '−' + fmtMoneyFull(outflow) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'var(--text3)' }}>
                          {net !== 0 ? (net > 0 ? '+' : '−') + fmtMoneyFull(Math.abs(net)) : '0'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: bal < 0 ? 'var(--red)' : 'var(--text)' }}>
                          {fmtMoneyFull(bal)}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {(d.events || []).length > 0
                            ? (d.events || []).map((ev, k) => <Badge key={k} tone={ev.tone || 'blue'}>{tt(ev.label)}</Badge>)
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('Прогноз строится на дебиторке клиентов и долгах поставщикам со сроками оплаты')}
            {branchId ? ' (' + tt('выбранный филиал') + ')' : ' (' + tt('все филиалы') + ')'}.{' '}
            {tt('Сценарии корректируют притоки/оттоки для оценки риска. Это прогноз, не гарантия.')}
          </div>
        </>
      )}
    </>
  );
}
