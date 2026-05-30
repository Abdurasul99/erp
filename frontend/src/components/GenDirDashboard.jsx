import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { fmtNum } from '../utils.js';

export default function GenDirDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/company/dashboard');
      setData(data);
    } catch {}
    setLoading(false);
  };

  if (loading) return <div className="center" style={{ padding: '60px' }}><div className="spinner" /></div>;
  if (!data) return null;

  const totalRevenue = data.branches.reduce((s, b) => s + b.sales_revenue, 0);
  const totalCost    = data.branches.reduce((s, b) => s + b.sales_cost, 0);
  const totalProfit  = data.branches.reduce((s, b) => s + b.gross_profit, 0);
  const totalBalance = data.branches.reduce((s, b) => s + b.cash_balance, 0);
  const totalStock   = data.branches.reduce((s, b) => s + b.stock_value, 0);
  const netProfit    = totalBalance + totalProfit;

  const fmt = (v) => fmtNum(v);

  return (
    <div>
      {/* ── Company totals ── */}
      <div className="grid-3" style={{ marginBottom: '16px' }}>
        {[
          { label: t('salesRevenue'),  value: fmt(totalRevenue),  color: 'var(--primary)', sign: '' },
          { label: t('salesCost'),     value: fmt(totalCost),     color: 'var(--orange)',  sign: '' },
          { label: t('grossProfit'),   value: fmt(totalProfit),   color: totalProfit  >= 0 ? 'var(--green)' : 'var(--red)', sign: totalProfit  >= 0 ? '+' : '' },
          { label: t('cashBalance'),   value: fmt(totalBalance),  color: totalBalance >= 0 ? 'var(--primary)' : 'var(--red)', sign: '' },
          { label: t('stockValue'),    value: fmt(totalStock),    color: 'var(--text)',    sign: '' },
          { label: t('netProfit'),     value: fmt(netProfit),     color: netProfit    >= 0 ? 'var(--green)' : 'var(--red)', sign: netProfit    >= 0 ? '+' : '' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value mono" style={{ color: s.color, fontSize: '18px' }}>
              {s.sign}{s.value}
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text2)', marginLeft: '4px' }}>UZS</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Net profit highlight ── */}
      <div style={{
        background: netProfit >= 0 ? 'linear-gradient(135deg, #1e1b4b, #3730a3)' : 'linear-gradient(135deg, #7f1d1d, #dc2626)',
        borderRadius: '16px', padding: '20px 28px', color: '#fff', marginBottom: '24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '12px', opacity: .7, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
            {t('netProfit')} — {t('companyOverview')}
          </div>
          <div className="mono" style={{ fontSize: '32px', fontWeight: 900 }}>
            {netProfit >= 0 ? '+' : '−'}{fmt(Math.abs(netProfit))}
            <span style={{ fontSize: '16px', marginLeft: '8px', opacity: .7 }}>UZS</span>
          </div>
        </div>
        <button onClick={load} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontFamily: "'Nunito', sans-serif", fontSize: '13px' }}>
          {t('refresh')}
        </button>
      </div>

      {/* ── Branches ── */}
      <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '14px' }}>{t('companyBranches')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '16px' }}>
        {data.branches.map(b => (
          <div key={b.branch_id} className="card" style={{
            border: `2px solid ${selectedBranch === b.branch_id ? 'var(--primary)' : 'var(--border)'}`,
            cursor: 'pointer', transition: 'all .2s',
          }} onClick={() => setSelectedBranch(selectedBranch === b.branch_id ? null : b.branch_id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px' }}>{b.branch_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{b.worker_count} {t('employees')}</div>
              </div>
              <span style={{
                fontSize: '13px', fontWeight: 800, padding: '4px 12px', borderRadius: '20px',
                background: b.gross_profit >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                color: b.gross_profit >= 0 ? '#16a34a' : 'var(--red)',
              }}>
                {b.gross_profit >= 0 ? '+' : ''}{fmt(b.gross_profit)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: t('salesRevenue'), value: fmt(b.sales_revenue), color: 'var(--primary)' },
                { label: t('salesCost'),    value: fmt(b.sales_cost),    color: 'var(--orange)' },
                { label: t('cashBalance'),  value: fmt(b.cash_balance),  color: b.cash_balance >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: t('stockValue'),   value: fmt(b.stock_value),   color: 'var(--text)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: '13px', color: s.color, marginTop: '2px' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
