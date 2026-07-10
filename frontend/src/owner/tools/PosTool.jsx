import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Касса B2C» в окне руководителя — это НЕ терминал продажи (продажи ведут
// кассиры/продавцы в своём приложении). Здесь руководитель видит РЕАЛЬНЫЙ
// монитор смены: что продано сегодня, на какую сумму, какими способами оплаты.
const PM_LABEL = {
  cash: '💵 Наличные', card: '💳 Карта', transfer: '🏦 Перевод', wire: '🏛 Перечисление', debt: '📋 В долг',
};
const PM_COLOR = { cash: '#16A34A', card: '#1D4ED8', transfer: '#0EA5E9', wire: '#1D4ED8', debt: '#D97706' };

export default function PosTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const params = { from };
    if (branchId) params.branch_id = branchId;
    api.get('/sales/history', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const kpi = data?.kpi || {};
  const rows = data?.rows || [];

  // Разбивка выручки по способам оплаты (из реальных строк за сегодня)
  const byPm = {};
  for (const r of rows) {
    if (r.payment_status === 'paid' || r.pm !== 'debt') {
      byPm[r.pm] = (byPm[r.pm] || 0) + r.total;
    }
  }
  const pmEntries = Object.entries(byPm).sort((a, b) => b[1] - a[1]);
  const todaySum = kpi.today_sum || 0;

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <PageHeader title={tt('🛒 Касса · монитор смены')} sub={tt('Реальные продажи за сегодня · режим наблюдения')} />

      <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          ℹ️ {tt('Это')} <strong>{tt('монитор для руководителя')}</strong> — {tt('здесь видно, что продаётся в реальном времени.')}
          {' '}{tt('Сами продажи кассиры и продавцы проводят в своём приложении (POS на телефоне).')}
          {' '}{tt('Цифры ниже — настоящие, обновляются по мере продаж.')}
        </div>
      </Card>

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🧾" label={tt('Чеков сегодня')} value={fmtNum(kpi.today_count || 0)} sub={tt('за смену')} color="#1D4ED8" />
        <Tile icon="💰" label={tt('Выручка сегодня')} value={fmtMoneyFull(kpi.today_sum || 0)} sub={tt('сум')} color="#16A34A" />
        <Tile icon="🧮" label={tt('Средний чек')} value={fmtMoneyFull(kpi.avg_check || 0)} sub={tt('сум · за период')} color="#D97706" />
        <Tile icon="📋" label={tt('В долг')} value={fmtNum(kpi.debt_count || 0)} sub={tt('непогашено')} color={kpi.debt_count > 0 ? '#DC2626' : '#94A0B5'} />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Разбивка по способам оплаты — реальная */}
        <Card icon="💳" title={tt('Выручка по способам оплаты')}>
          {loading && !data ? (
            <div>{[0, 1, 2].map(i => <Skeleton key={i} height={28} style={{ marginBottom: 8 }} />)}</div>
          ) : pmEntries.length === 0 ? (
            <EmptyState icon="💤" title={tt('Сегодня продаж ещё не было')} description={tt('Как только кассир проведёт продажу — она появится здесь.')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {pmEntries.map(([method, sum]) => {
                const pct = todaySum > 0 ? Math.round((sum / todaySum) * 100) : 0;
                return (
                  <div key={method}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{PM_LABEL[method] ? tt(PM_LABEL[method]) : method}</span>
                      <span className="mono" style={{ fontWeight: 800 }}>{fmtMoneyFull(sum)} {tt('сум')} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: PM_COLOR[method] || '#1D4ED8', borderRadius: 6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Последние продажи смены — реальные */}
        <Card icon="🕐" title={tt('Последние продажи')}>
          {loading && !data ? (
            <div>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={32} style={{ marginBottom: 8 }} />)}</div>
          ) : error ? (
            <div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon="🧾" title={tt('Пока пусто')} description={tt('Продажи смены появятся здесь в реальном времени.')} />
          ) : (
            <div className="list">
              {rows.slice(0, 8).map(s => (
                <div key={s.id} className="list-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="list-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product}</div>
                    <div className="list-item-sub">{fmtTime(s.date)} · {PM_LABEL[s.pm] ? tt(PM_LABEL[s.pm]) : s.pm}{s.customer ? ' · ' + s.customer : ''}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{fmtMoneyFull(s.total)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
