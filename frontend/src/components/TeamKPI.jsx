import React, { useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { fmtMoney, fmtNum, formatLastLogin, periodRange } from '../utils.js';
import { Icon } from '../icons.jsx';
import PeriodFilter from './PeriodFilter.jsx';
import { AuthContext } from '../App.jsx';

const ROLE_KEYS = { founder: 'founderRole', director: 'genDirRole', manager: 'managerRole', cashier: 'cashierRole', warehouse: 'warehouseRole', seller: 'sellerRole' };
const roleColor = { founder: '#7c3aed', director: '#4338ca', manager: '#4338ca', cashier: '#16a34a', warehouse: '#d97706', seller: '#dc2626' };
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
const uzNoBranch = (t) => t('noBranch') || 'Без филиала';

export default function TeamKPI() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [roleFilter, setRoleFilter] = useState('all');
  // For company-level viewers (founder/director) → group by branch
  const groupByBranch = user?.role === 'founder' || user?.role === 'director';

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period, customRange.from, customRange.to]);

  const load = async () => {
    setLoading(true);
    try {
      const [from, to] = periodRange(period, customRange);
      const params = {};
      if (from) params.from = from.toISOString();
      if (to)   params.to   = to.toISOString();
      const { data } = await api.get('/team/kpi', { params });
      setRows(data);
    } catch {}
    setLoading(false);
  };

  const filtered = rows.filter(r => roleFilter === 'all' || r.role === roleFilter);
  const totals = filtered.reduce((a, r) => ({
    revenue: a.revenue + parseFloat(r.revenue || 0),
    profit:  a.profit  + parseFloat(r.profit  || 0),
    sales:   a.sales   + parseInt(r.sales_count || 0),
  }), { revenue: 0, profit: 0, sales: 0 });

  // Find top performer for highlighting (across all branches)
  const topId = filtered.length > 0 ? filtered.reduce((top, r) => parseFloat(r.revenue) > parseFloat(top.revenue) ? r : top, filtered[0])?.id : null;

  const availableRoles = [...new Set(rows.map(r => r.role))];

  // Group rows by branch (only when company-level viewer)
  const grouped = groupByBranch
    ? filtered.reduce((acc, r) => {
        const key = r.branch_id || 0;
        const name = r.branch_name || (uzNoBranch(t));
        if (!acc[key]) acc[key] = { branch_id: r.branch_id, branch_name: name, rows: [], totals: { sales: 0, revenue: 0, profit: 0 } };
        acc[key].rows.push(r);
        acc[key].totals.sales   += parseInt(r.sales_count || 0);
        acc[key].totals.revenue += parseFloat(r.revenue || 0);
        acc[key].totals.profit  += parseFloat(r.profit || 0);
        return acc;
      }, {})
    : null;
  const branchGroups = grouped ? Object.values(grouped).sort((a, b) => b.totals.revenue - a.totals.revenue) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 0 }}>
      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">{t('totalSales')}</div>
          <div className="stat-value mono" style={{ color: 'var(--primary)' }}>{totals.sales}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="stat-label">{t('totalSum')}</div>
          <div className="stat-value mono" style={{ color: 'var(--green)', fontSize: '20px' }}>{fmtMoney(totals.revenue)}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${totals.profit >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
          <div className="stat-label">{t('grossProfit')}</div>
          <div className="stat-value mono" style={{ color: totals.profit >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '20px' }}>
            {totals.profit >= 0 ? '+' : '−'}{fmtMoney(Math.abs(totals.profit))}
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0, marginRight: 'auto' }}>👥 {t('teamKpi')}</div>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
          <select className="input" style={{ width: '170px' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">{t('allRoles')}</option>
            {availableRoles.map(r => <option key={r} value={r}>{t(ROLE_KEYS[r]) || r}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh')}</button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>{t('employee')}</th>
                  <th>{t('role')}</th>
                  <th>{t('lastLogin')}</th>
                  <th style={{ textAlign: 'right' }}>{t('salesCount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('revenue')}</th>
                  <th style={{ textAlign: 'right' }}>{t('profit')}</th>
                  <th style={{ textAlign: 'right' }}>{t('toSettle')}</th>
                  <th style={{ textAlign: 'right' }}>{t('pendingApprovals')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData')}</td></tr>
                )}
                {/* Grouped view: render branch header rows between groups */}
                {groupByBranch ? branchGroups.flatMap(g => [
                  <tr key={`b-${g.branch_id}`} style={{ background: 'linear-gradient(90deg, rgba(67,56,202,.08), rgba(67,56,202,.02))' }}>
                    <td colSpan={4} style={{ padding: '12px 14px', fontWeight: 900, fontSize: '14px', color: 'var(--primary)' }}>
                      🏪 {g.branch_name} <span style={{ marginLeft: '6px', color: '#9EA3BF', fontSize: '11px', fontWeight: 700 }}>({g.rows.length})</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)' }}>{g.totals.sales}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--green)' }}>{fmtNum(g.totals.revenue)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: g.totals.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {g.totals.profit >= 0 ? '+' : '−'}{fmtNum(Math.abs(g.totals.profit))}
                    </td>
                    <td colSpan={2} />
                  </tr>,
                  ...g.rows.map((r, i) => renderEmployeeRow(r, i, topId, t))
                ]) : filtered.map((r, i) => renderEmployeeRow(r, i, topId, t))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to render a single employee row (DRY between grouped and flat views)
function renderEmployeeRow(r, i, topId, t) {
  const ll = formatLastLogin(r.last_login_at, t);
  const isTop = r.id === topId && parseFloat(r.revenue) > 0;
  return (
    <tr key={r.id} style={{ background: isTop ? 'rgba(255,193,7,.06)' : undefined }}>
      <td style={{ fontWeight: 800, color: i < 3 && parseFloat(r.revenue) > 0 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : '#9EA3BF' }}>
        {isTop ? '🏆' : i + 1}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: (roleColor[r.role] || '#6B6F8A') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={13} color={roleColor[r.role] || '#6B6F8A'} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>{fullName(r)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>@{r.username}</div>
          </div>
        </div>
      </td>
      <td>
        <span style={{ background: (roleColor[r.role] || '#6B6F8A') + '15', color: roleColor[r.role] || '#6B6F8A', padding: '3px 9px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>
          {t(ROLE_KEYS[r.role]) || r.role}
        </span>
      </td>
      <td>
        <span style={{ background: ll.color + '18', color: ll.color, padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
          {ll.recent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ll.color }} />}
          {ll.text}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 700 }}>{r.sales_count}</span></td>
      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 800, color: parseFloat(r.revenue) > 0 ? 'var(--green)' : 'var(--text3)' }}>{fmtNum(r.revenue)}</span></td>
      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 700, color: parseFloat(r.profit) > 0 ? 'var(--green)' : parseFloat(r.profit) < 0 ? 'var(--red)' : 'var(--text3)' }}>{parseFloat(r.profit) >= 0 ? '+' : '−'}{fmtNum(Math.abs(r.profit))}</span></td>
      <td style={{ textAlign: 'right' }}>
        {parseFloat(r.unsettled_amount) > 0 ? (
          <span style={{ background: 'rgba(255,193,7,.15)', color: '#d97706', padding: '2px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '11px', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
            {fmtNum(r.unsettled_amount)}
          </span>
        ) : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        {parseInt(r.pending_count) > 0 ? (
          <span style={{ background: 'rgba(245,158,11,.15)', color: '#d97706', padding: '2px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '11px' }}>
            ⏳ {r.pending_count}
          </span>
        ) : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
    </tr>
  );
}

