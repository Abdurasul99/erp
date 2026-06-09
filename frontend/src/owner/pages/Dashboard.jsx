import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { BranchScope } from '../OwnerShell.jsx';
import { Tile, Card, Badge, AreaChart, Sparkline, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
  { value: 'all',   label: 'Всё' },
];

function periodRange(p) {
  const now = new Date();
  let from = null;
  if (p === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (p === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 7);
  } else if (p === 'month') {
    from = new Date(now); from.setMonth(now.getMonth() - 1);
  } else if (p === 'year') {
    from = new Date(now); from.setFullYear(now.getFullYear() - 1);
  }
  return { from: from ? from.toISOString() : null, to: null };
}

function deltaPct(current, prev) {
  if (prev == null) return null;
  if (prev === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prev) / Math.abs(prev)) * 100);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { branchId, isOwner, role, branches: allBranches } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const { from, to } = periodRange(period);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [period, branchId]);

  const t = data?.totals || {};
  const prev = data?.prev_totals || {};
  const branches = data?.branches || [];
  const trend = data?.sales_trend || [];
  const prevTrend = data?.prev_trend || [];
  const topProducts = data?.top_products || [];
  const topSellers = data?.top_sellers || [];
  const alerts = data?.alerts || [];

  const trendValues = useMemo(() => trend.map(x => x.revenue), [trend]);
  const prevTrendValues = useMemo(() => prevTrend.map(x => x.revenue), [prevTrend]);
  const trendLabels = useMemo(() => {
    if (!trend.length) return [];
    const fmt = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    if (trend.length === 1) return [fmt(trend[0].date)];
    return [fmt(trend[0].date), fmt(trend[Math.floor(trend.length / 2)].date), fmt(trend[trend.length - 1].date)];
  }, [trend]);

  const revDelta = deltaPct(t.sales_revenue, prev.sales_revenue);
  const profitDelta = deltaPct(t.gross_profit, prev.gross_profit);
  const dealsDelta = deltaPct(t.deals_count, prev.deals_count);
  const checkDelta = deltaPct(t.avg_check, prev.avg_check);

  const scopeLabel = isOwner
    ? (branchId ? (allBranches.find(x => x.id === branchId)?.name || `Филиал #${branchId}`) : 'Все филиалы')
    : (role === 'manager' ? 'Мой филиал' : '');

  return (
    <>
      <PageHeader
        title="Главная панель"
        sub={`${scopeLabel} · ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={<Pills value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
      />

      {error && (
        <Card icon="⚠️" title="Ошибка загрузки">
          <div style={{ color: 'var(--red)' }}>{error}</div>
        </Card>
      )}

      {loading && !data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 16 }} className="dashboard-hero-row">
            <div className="card" style={{ minHeight: 200, padding: 28 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={44} style={{ width: '70%', marginBottom: 12 }} />
              <Skeleton height={12} style={{ width: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <Skeleton height={12} style={{ width: '50%', marginBottom: 10 }} />
                  <Skeleton height={22} style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
          </div>
          <div className="grid-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="card" style={{ padding: 22 }}>
                <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
                <Skeleton height={12} style={{ marginBottom: 8 }} />
                <Skeleton height={12} style={{ marginBottom: 8 }} />
                <Skeleton height={12} style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Hero row: Выручка (large hero tile) + Касса/Продажи/Чек (compact column) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 16 }} className="dashboard-hero-row">
            {/* Hero tile — Выручка (biggest) */}
            <div style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #22C55E 60%, #4ade80 100%)',
              borderRadius: 18,
              padding: '28px 30px',
              color: '#fff',
              boxShadow: '0 8px 28px rgba(34,197,94,.32)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: 200,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, opacity: .85, textTransform: 'uppercase', letterSpacing: .8 }}>
                  💰 Выручка за период
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 900, lineHeight: 1.05, marginTop: 8, letterSpacing: -1 }}>
                  {fmtMoney(t.sales_revenue)} <span style={{ fontSize: 18, opacity: .7 }}>UZS</span>
                </div>
                {revDelta != null && (
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>
                    {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta)}% к прошлому периоду
                    <span style={{ marginLeft: 8, opacity: .65, fontWeight: 600 }}>
                      ({fmtMoney(prev.sales_revenue)})
                    </span>
                  </div>
                )}
              </div>
              {trendValues.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={trendValues} color="rgba(255,255,255,.85)" />
                </div>
              )}
            </div>

            {/* Right column: 3 compact tiles stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CompactTile icon="🏦" label="Касса (баланс)" value={fmtMoney(t.cash_balance)} sub="UZS" color="#0EA5E9" />
              <CompactTile icon="📦" label="Продаж"        value={fmtNum(t.deals_count)}    sub="за период"
                delta={dealsDelta} color="#5B4FE8" />
              <CompactTile icon="🧾" label="Средний чек"   value={fmtMoney(t.avg_check)}    sub="UZS"
                delta={checkDelta} color="#FF6B2B" />
            </div>
          </div>

          {/* Two area charts side by side: period sales + prev comparison */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="📈" title={`Продажи · ${PERIOD_OPTIONS.find(p => p.value === period)?.label || ''}`}
              actions={<Badge tone="blue">{fmtMoney(trendValues.reduce((a, b) => a + b, 0))} UZS</Badge>}>
              <AreaChart data={trendValues} color="#5B4FE8" height={150} labels={trendLabels} />
            </Card>

            <Card icon="📊" title="Сравнение с прошлым периодом"
              actions={revDelta != null && (
                <Badge tone={revDelta >= 0 ? 'green' : 'red'}>
                  {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta)}%
                </Badge>
              )}>
              {prevTrendValues.length > 0 ? (
                <>
                  <AreaChart data={trendValues} prevData={prevTrendValues} color="#22C55E" prevColor="#9094B0" height={150} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 16, height: 3, background: '#22C55E', borderRadius: 2 }} />
                      <span style={{ color: 'var(--text2)' }}>Сейчас: <strong>{fmtMoney(t.sales_revenue)}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 16, height: 0, borderTop: '2px dashed #9094B0' }} />
                      <span style={{ color: 'var(--text2)' }}>Раньше: <strong>{fmtMoney(prev.sales_revenue)}</strong></span>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="📅"
                  title="Сравнение недоступно"
                  description={period === 'all'
                    ? 'Для периода «Всё» нет предыдущего периода для сравнения. Переключитесь на Неделя/Месяц/Год.'
                    : 'Сравнение появится для периодов Неделя/Месяц/Год — там есть предыдущий период.'}
                />
              )}
            </Card>
          </div>

          {/* Cash flow detail (compact) */}
          <Card icon="💸" title="Денежный поток" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Приход</div>
                <div className="mono" style={{ fontWeight: 800, color: 'var(--green)', fontSize: 20, marginTop: 4 }}>+{fmtMoney(t.cash_income)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Расход</div>
                <div className="mono" style={{ fontWeight: 800, color: 'var(--red)', fontSize: 20, marginTop: 4 }}>−{fmtMoney(t.cash_expense)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Прибыль</div>
                <div className="mono" style={{ fontWeight: 800, color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 20, marginTop: 4 }}>{fmtMoney(t.gross_profit)}</div>
                {profitDelta != null && (
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2, color: profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {profitDelta >= 0 ? '▲' : '▼'} {Math.abs(profitDelta)}%
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Склад</div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>{fmtMoney(t.stock_value)}</div>
              </div>
            </div>
          </Card>

          {/* Manager context: show a "Мой филиал" badge with the branch name when no comparison table is rendered */}
          {!isOwner && branches.length === 1 && (
            <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--primary-50)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>🏭</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>Ваш филиал</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{branches[0].branch_name}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text3)', fontWeight: 700 }}>Сотрудников</div>
                    <div className="mono" style={{ fontWeight: 800, fontSize: 16 }}>{branches[0].worker_count}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text3)', fontWeight: 700 }}>Маржа</div>
                    <div className="mono" style={{ fontWeight: 800, fontSize: 16 }}>{branches[0].margin_pct}%</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {isOwner && branches.length > 1 && (
            <Card icon="🏭" title="Сравнение филиалов"
              actions={<Badge tone="purple">{branches.length} филиалов</Badge>}
              style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Филиал</th>
                      <th style={{ textAlign: 'right' }}>Выручка</th>
                      <th style={{ textAlign: 'right' }}>Прибыль</th>
                      <th style={{ textAlign: 'right' }}>Маржа</th>
                      <th style={{ textAlign: 'right' }}>Сделок</th>
                      <th style={{ textAlign: 'right' }}>Касса</th>
                      <th style={{ textAlign: 'right' }}>Склад</th>
                      <th style={{ textAlign: 'right' }}>Сотр.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.branch_id}>
                        <td style={{ fontWeight: 700 }}>
                          🏭 {b.branch_name}{' '}
                          {b.margin_pct < 10 && b.sales_revenue > 0 && <Badge tone="red">маржа↓</Badge>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(b.sales_revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.gross_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoney(b.gross_profit)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.margin_pct}%</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(b.deals_count)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.cash_balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoney(b.cash_balance)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(b.stock_value)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.worker_count}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(91,79,232,.05)', fontWeight: 800 }}>
                      <td>ИТОГО</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(t.sales_revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoney(t.gross_profit)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.margin_pct}%</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(t.deals_count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(t.cash_balance)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(t.stock_value)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.worker_count}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Card icon="⚠️" title="Алерты" actions={alerts.length > 0 && <Badge tone="red">{alerts.length}</Badge>}>
              <div className="list">
                {alerts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>✓ Всё спокойно</div>
                ) : alerts.map((a, i) => (
                  <div key={i} className="list-item">
                    <div style={{ width: 5, height: 34, borderRadius: 3, background: ({ red: '#EF4444', yellow: '#F59E0B', blue: '#5B4FE8', purple: '#7c3aed' })[a.tone] || '#6B7280' }} />
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{a.title}</div>
                      <div className="list-item-sub">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="🏆" title="Топ товаров" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/warehouse/stock')}>Все →</button>}>
              <div className="list">
                {topProducts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>Нет данных</div>
                ) : topProducts.map((p, i) => (
                  <div key={p.id} className="list-item">
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: i < 3 ? 'rgba(255,107,43,.15)' : 'var(--bg-2)',
                      color: i < 3 ? 'var(--orange)' : 'var(--text2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 11,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="list-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div className="list-item-sub">{fmtNum(p.qty)} {p.unit}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 12 }}>{fmtMoney(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="👤" title="Топ сотрудников" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/management/team-kpi')}>KPI →</button>}>
              <div className="list">
                {topSellers.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>Нет данных</div>
                ) : topSellers.map(s => {
                  const init = (s.name || s.username || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={s.id} className="list-item">
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{init}</div>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-sub">{s.deals} сделок · {s.role}</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 12 }}>{fmtMoney(s.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// Compact tile for the right column next to the hero — about 1/3 height of the hero.
function CompactTile({ icon, label, value, sub, delta, color }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '14px 16px',
      border: '1px solid rgba(230,232,242,.6)',
      borderLeft: `4px solid ${color}`,
      boxShadow: 'var(--shadow)',
      flex: 1,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>
        {icon} {label}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        {sub && <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{sub}</div>}
        {delta != null && (
          <div style={{ fontSize: 11, fontWeight: 800, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </div>
        )}
      </div>
    </div>
  );
}
