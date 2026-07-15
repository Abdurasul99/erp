import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIOD_OPTS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

export default function CurrencyOpsTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/currency', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const d = data || {};
  const ops = d.operations || [];

  return (
    <>
      <PageHeader title={'💱 ' + tt('Валютные операции')} sub={tt('Долларовые закупки и продажи · курс, эквивалент в сумах, потери')} />

      <div style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod}
          options={PERIOD_OPTS.map(o => ({ value: o.value, label: tt(o.label) }))}
          label={tt("Период")} />
      </div>

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !d.ops_count ? (
        <Card><EmptyState icon="💱" title={tt('Нет валютных операций за период')} description={tt('Здесь появятся закупки и продажи в валюте (не в сумах). Пока операций нет.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔢" label={tt('Операций в USD')} value={fmtNum(d.ops_count)} sub={tt('за период')} color="#1D4ED8" />
            <Tile icon="💵" label={tt('Итого USD')} value={fmtNum(d.total_usd) + ' $'} sub={tt('сумма в долларах')} color="#16A34A" />
            <Tile icon="🇺🇿" label={tt('Эквивалент в сумах')} value={fmtMoneyFull(d.total_uzs)} sub={tt('сум · по курсам операций')} color="#0EA5E9" />
            <Tile icon="📈" label={tt('Средневзвешенный курс')} value={d.avg_rate != null ? fmtMoneyFull(d.avg_rate) : '—'} sub={tt('сум за 1 $')} color="#D97706" />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="⚠️" title={tt('Потери от изменения курса')}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>
                −{fmtMoneyFull(d.fx_loss)} <span style={{ fontSize: 13, fontWeight: 600 }}>{tt('сум')}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                {tt('Курсовая разница между курсом при выставлении счёта и курсом при оплате.')}
              </div>
            </Card>
            <Card icon="🏦" title={tt('Потери при конвертации')}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>
                −{fmtMoneyFull(d.fee_loss)} <span style={{ fontSize: 13, fontWeight: 600 }}>{tt('сум')}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                {fmtNum(d.total_usd)} $ {tt('обменяно в банке')} · {tt('комиссия')} ≈ 0.5%
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                ⚠️ {tt('Итого потери на валюте')}
              </div>
              <Badge tone="red">−{fmtMoneyFull(d.total_loss)} {tt('сум')}</Badge>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              {tt('Сумма курсовой разницы и банковской комиссии за период.')}
            </div>
          </Card>

          <Card icon="📋" title={tt('Все долларовые операции')}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text3)', fontWeight: 700, borderBottom: '1.5px solid var(--border, #E3EAF3)' }}>
                    <th style={{ padding: '8px 10px' }}>{tt('Дата и время')}</th>
                    <th style={{ padding: '8px 10px' }}>{tt('Тип')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Сумма ($)')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Курс (сум/$)')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Итого (сум)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border, #EEF2F8)' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {fmtDate(new Date(o.created_at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, lang)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge tone={o.type === 'sale' ? 'green' : 'blue'}>
                          {o.type === 'sale' ? tt('Продажа') : tt('Закупка')}
                        </Badge>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtNum(o.amount_usd)} $</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoneyFull(o.rate)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtMoneyFull(o.total_uzs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ops.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет операций для показа')}</div>
            )}
          </Card>

          <AiAnalyze topic="currency-ops" branchId={branchId} />
        </>
      )}
    </>
  );
}
