import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Статус оттока: ушёл (>90 дн или просрочил цикл значительно), риск (пропустил цикл),
// активен (покупает в рамках цикла). Бейдж-тон по статусу.
const STATUS_META = {
  lost:   { label: 'Ушёл',     tone: 'red',    icon: '🚪' },
  risk:   { label: 'В зоне риска', tone: 'orange', icon: '⚠️' },
  active: { label: 'Активен',  tone: 'green',  icon: '✅' },
};

export default function ChurnTool() {
  const { tt } = useTt();
  const { branchId, period } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (period) params.period = period;
    api.get('/customers/churn', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const customers = data?.customers || [];
  const kpi = data?.kpi || {};

  const createCallTask = (c) => {
    const body = {
      title: tt('Обзвон: вернуть клиента') + ` — ${c.name}`,
      description: `${tt('Телефон')}: ${c.phone || '—'}. ${tt('Покупок')}: ${c.orders}. `
        + `${tt('Дней без покупки')}: ${c.days_since ?? '—'}. LTV: ${fmtMoney(c.ltv)} ${tt('сум')}.`,
      priority: c.status === 'lost' ? 'high' : 'medium',
    };
    if (branchId) body.branch_id = branchId;
    api.post('/tasks', body)
      .then(() => alert(tt('Задача-обзвон создана')))
      .catch(e => alert(e.response?.data?.error || e.message));
  };

  const filtered = tab === 'all'
    ? customers
    : customers.filter(c => c.status === tab);

  const riskCount = customers.filter(c => c.status === 'risk').length;
  const lostCount = customers.filter(c => c.status === 'lost').length;

  const tabs = [
    { value: 'all', label: tt('Все') + ` (${customers.length})` },
    { value: 'risk', label: '⚠️ ' + tt('Риск') + ` (${riskCount})` },
    { value: 'lost', label: '🚪 ' + tt('Ушедшие') + ` (${lostCount})` },
  ];

  return (
    <>
      <PageHeader
        title={tt('🚪 Отток клиентов')}
        sub={tt('Кто перестал покупать · кто в зоне риска · выручка под угрозой')}
        actions={<Badge tone="blue">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🚪" label={tt('Ушли (>90 дней)')} value={fmtNum(kpi.lost || 0)}
              sub={tt('клиентов')} color="#DC2626" />
            <Tile icon="⚠️" label={tt('В зоне риска')} value={fmtNum(kpi.risk || 0)}
              sub={tt('пропустили цикл')} color="#D97706" />
            <Tile icon="💸" label={tt('Выручка под риском')} value={fmtMoney(kpi.revenue_at_risk || 0)}
              sub={tt('сум · LTV риск-клиентов')} color="#1D4ED8" />
            <Tile icon="📉" label={tt('Churn rate / мес')} value={(kpi.churn_rate || 0).toFixed(1) + '%'}
              sub={tt('доля ушедших')} color="#6B7280" />
          </div>

          <Card icon="📋" title={`${tt('Клиенты')} (${filtered.length})`}
            actions={<Pills value={tab} onChange={setTab} options={tabs} />}>
            {filtered.length === 0 ? (
              <EmptyState icon="🎉" title={tt('Нет клиентов в этой группе')}
                description={tt('За выбранный период отток не обнаружен — все клиенты покупают в рамках своего цикла.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Клиент')}</th>
                      <th>{tt('Телефон')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Покупок')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Цикл (дн)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Без покупки (дн)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Посл. покупка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('LTV')}</th>
                      <th>{tt('Статус')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 300).map(c => {
                      const sm = STATUS_META[c.status] || STATUS_META.active;
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 700 }}>{c.name}</td>
                          <td className="mono" style={{ fontSize: 12 }}>
                            {c.phone
                              ? <a href={`tel:${c.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{c.phone}</a>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.orders)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{c.cycle_days != null ? c.cycle_days : '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: c.status === 'lost' ? '#DC2626' : c.status === 'risk' ? '#D97706' : 'var(--text)' }}>{c.days_since != null ? c.days_since : '—'}</td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>{c.last_at || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.ltv)}</td>
                          <td><Badge tone={sm.tone}>{sm.icon} {tt(sm.label)}</Badge></td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => createCallTask(c)}
                              title={tt('Создать задачу-обзвон')}>
                              📞 {tt('Обзвон')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length > 300 && (
                  <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                    {tt('Показаны первые 300 из')} {filtered.length}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('«Цикл» — типичный интервал между покупками клиента. Пропуск 1+ цикла = зона риска, >90 дней без покупки = ушёл.')}
          </div>
        </>
      )}
    </>
  );
}
