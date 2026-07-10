import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { Tile, Card, Badge, PageHeader, Pills, Skeleton, fmtMoney, fmtNum } from '../../owner/ui.jsx';

const PERIOD_OPTIONS = [
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
  { value: 'all',   label: 'Всё' },
];

function periodRange(p) {
  const now = new Date();
  let from = null;
  if (p === 'week')  { from = new Date(now); from.setDate(now.getDate() - 7); }
  else if (p === 'month') { from = new Date(now); from.setMonth(now.getMonth() - 1); }
  else if (p === 'year')  { from = new Date(now); from.setFullYear(now.getFullYear() - 1); }
  return { from: from ? from.toISOString() : null };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('health_risk');

  useEffect(() => {
    setLoading(true); setError(null);
    const { from } = periodRange(period);
    api.get('/admin/dashboard', { params: from ? { from } : {} })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const summary = data?.summary || {};
  const totals = data?.totals || {};
  const companies = data?.companies || [];

  const sorted = [...companies].sort((a, b) => {
    if (sort === 'health_risk')  return rankHealth(a.health) - rankHealth(b.health);
    if (sort === 'users_desc')   return (b.users_count || 0) - (a.users_count || 0);
    if (sort === 'created_desc') return new Date(b.created_at) - new Date(a.created_at);
    return 0;
  });

  return (
    <>
      <PageHeader
        title="🛡️ Панель администратора SaaS"
        sub="Здоровье всех клиентов · feature-flags · мониторинг"
        actions={<Pills value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>}

      {loading && !data ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <Skeleton height={12} style={{ width: '50%', marginBottom: 10 }} />
                <Skeleton height={26} style={{ width: '70%' }} />
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <Skeleton height={14} style={{ width: '30%', marginBottom: 16 }} />
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} height={36} style={{ marginBottom: 8 }} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏢" label="Всего компаний"  value={fmtNum(summary.total_companies)} sub="клиентов SaaS"           color="#5B4FE8" />
            <Tile icon="✅" label="Активны (30д)"    value={fmtNum(summary.active_30d)}     sub="заходили недавно"        color="#22C55E" />
            <Tile icon="⚠️" label="В риске churn"  value={fmtNum(summary.at_risk)}        sub="давно не заходят"        color="#EF4444" />
            <Tile icon="✨" label="Новые (30д)"      value={fmtNum(summary.new_this_month)} sub="последний месяц"         color="#FF6B2B" />
          </div>

          <Card icon="🏢" title={`Компании · ${sorted.length}`}
            actions={
              <Pills value={sort} onChange={setSort} options={[
                { value: 'health_risk',  label: 'По риску' },
                { value: 'users_desc',   label: 'По юзерам' },
                { value: 'created_desc', label: 'По дате' },
              ]} />
            }>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th style={{ textAlign: 'center' }}>Здоровье</th>
                    <th style={{ textAlign: 'right' }}>Филиалов · юзеров</th>
                    <th style={{ textAlign: 'right' }}>Последний логин</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет компаний в системе</td></tr>
                  ) : sorted.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/companies/${c.id}`)}>
                      <td style={{ fontWeight: 700 }}>
                        🏢 {c.name}
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>ID #{c.id}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge tone={c.health.tone}>{c.health.label}</Badge>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{c.branches_count} · {c.users_count}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                        {c.health.days_since == null ? '—' : c.health.days_since === 0 ? 'сегодня' : `${c.health.days_since} дн назад`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/admin/companies/${c.id}`); }}>Открыть →</button>
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

function SysMetric({ label, value, unit, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontWeight: 600 }}>{unit}</div>
    </div>
  );
}

function rankHealth(h) {
  if (!h) return 99;
  if (h.status === 'inactive') return 0;
  if (h.status === 'risk') return 1;
  return 2;
}
