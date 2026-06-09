import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';

const TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'overdue',  label: '🔴 Просрочены' },
  { value: 'soon',     label: '🟡 Скоро срок' },
  { value: 'ok',       label: '🟢 В сроке' },
];

function dayDiff(due) {
  if (!due) return null;
  return Math.floor((new Date(due) - new Date()) / 86400000);
}

export default function DebtsTool() {
  const { branchId } = useContext(BranchScope);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/suppliers/debts', { params })
      .then(r => setDebts(r.data || []))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const enriched = useMemo(() => debts.map(d => ({
    ...d,
    days_to_due: dayDiff(d.due_date),
  })), [debts]);

  const summary = useMemo(() => {
    const overdue = enriched.filter(d => d.overdue);
    const soon = enriched.filter(d => !d.overdue && d.days_to_due != null && d.days_to_due <= 7);
    const ok = enriched.filter(d => !d.overdue && (d.days_to_due == null || d.days_to_due > 7));
    const totalAmount = enriched.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);
    const overdueAmount = overdue.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);
    return { total: enriched.length, overdue: overdue.length, soon: soon.length, ok: ok.length, totalAmount, overdueAmount };
  }, [enriched]);

  const filtered = useMemo(() => {
    if (tab === 'overdue') return enriched.filter(d => d.overdue);
    if (tab === 'soon')    return enriched.filter(d => !d.overdue && d.days_to_due != null && d.days_to_due <= 7);
    if (tab === 'ok')      return enriched.filter(d => !d.overdue && (d.days_to_due == null || d.days_to_due > 7));
    return enriched;
  }, [enriched, tab]);

  const bySupplier = useMemo(() => {
    const m = {};
    for (const d of enriched) {
      const key = d.supplier_id || 0;
      const name = d.supplier_name || 'Без поставщика';
      if (!m[key]) m[key] = { supplier_id: key, name, deals: 0, total: 0, overdue: 0 };
      m[key].deals++;
      m[key].total += parseFloat(d.remaining) || 0;
      if (d.overdue) m[key].overdue++;
    }
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [enriched]);

  return (
    <>
      <PageHeader
        title="📒 Долги поставщикам"
        sub="Что мы должны · приоритет по сроку"
        actions={<Badge tone={summary.overdue > 0 ? 'red' : 'green'}>
          {summary.overdue > 0 ? `${summary.overdue} просрочено` : 'Всё в сроке'}
        </Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>Загрузка...</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏭" label="Всего долгов" value={fmtNum(summary.total)}   sub={`${fmtMoney(summary.totalAmount)} UZS`} color="#0EA5E9" />
            <Tile icon="🔴" label="Просрочено"  value={fmtNum(summary.overdue)} sub={`${fmtMoney(summary.overdueAmount)} UZS`} color="#EF4444" />
            <Tile icon="🟡" label="Скоро срок"  value={fmtNum(summary.soon)}    sub="≤ 7 дней" color="#F59E0B" />
            <Tile icon="🟢" label="В сроке"     value={fmtNum(summary.ok)}      sub="> 7 дней" color="#22C55E" />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="🏆" title="Топ — кому мы должны">
              <div className="list">
                {bySupplier.length === 0 ? (
                  <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>Нет долгов поставщикам</div>
                ) : bySupplier.map((s, i) => (
                  <div key={s.supplier_id} className="list-item">
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: i < 3 ? 'rgba(14,165,233,.16)' : 'var(--bg-2)', color: i < 3 ? '#0EA5E9' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{s.name}</div>
                      <div className="list-item-sub">{s.deals} приходов{s.overdue > 0 && ` · ${s.overdue} просрочено`}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>{fmtMoney(s.total)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="💡" title="Что делать">
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text2)' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text)' }}>🔴 Просроченные ({summary.overdue})</div>
                  Оплатить срочно — иначе поставщик может отказаться от следующих поставок или поднять цены.
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text)' }}>💸 Управление наличными</div>
                  Если просрочка вынужденная — позвонить поставщику ДО срока, согласовать новый график.
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text)' }}>📈 Долгосрочно</div>
                  Регулярная оплата в срок = скидки + лучшие условия отсрочки в будущем.
                </div>
              </div>
            </Card>
          </div>

          <Card icon="📋" title={`Долги (${filtered.length})`} actions={<Pills value={tab} onChange={setTab} options={TABS} />}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Поставщик</th>
                    <th>Товар</th>
                    <th>Филиал</th>
                    <th style={{ textAlign: 'right' }}>Сумма</th>
                    <th style={{ textAlign: 'right' }}>Оплачено</th>
                    <th style={{ textAlign: 'right' }}>Остаток</th>
                    <th style={{ textAlign: 'right' }}>Срок</th>
                    <th style={{ textAlign: 'center' }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет долгов</td></tr>
                  ) : filtered.slice(0, 200).map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.supplier_name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{d.product_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{d.branch_name || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(d.total_amount)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--green)' }}>{fmtMoney(d.paid_amount)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: d.overdue ? 'var(--red)' : 'var(--text)' }}>{fmtMoney(d.remaining)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: d.overdue ? 'var(--red)' : 'var(--text2)' }}>
                        {d.due_date ? new Date(d.due_date).toLocaleDateString('ru-RU') : '—'}
                        {d.days_to_due != null && !d.overdue && d.days_to_due <= 7 && ` (${d.days_to_due} дн)`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {d.overdue
                          ? <Badge tone="red">Просрочен</Badge>
                          : d.days_to_due != null && d.days_to_due <= 7
                            ? <Badge tone="yellow">Скоро</Badge>
                            : <Badge tone="green">В сроке</Badge>}
                      </td>
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
