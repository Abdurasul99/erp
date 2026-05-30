import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { fmtNum, periodRange } from '../utils.js';
import PeriodFilter from './PeriodFilter.jsx';

export default function CashProfit() {
  const { t, lang } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try { const { data } = await api.get('/cash/profit'); setData(data); }
    catch (e) { setError(e.response?.data?.error || t('error')); }
    setLoading(false);
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const [from, to] = periodRange(period, customRange);
      const params = { lang };
      if (from) params.from = from.toISOString();
      if (to)   params.to   = to.toISOString();
      const res = await api.get('/reports/full', { params, responseType: 'blob' });
      const cd = res.headers['content-disposition'] || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const fname = m ? m[1] : `report_${Date.now()}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      // Blob errors don't expose JSON body unless we read it
      let msg = t('error');
      try { msg = JSON.parse(await e.response?.data?.text?.() || '{}').error || msg; } catch {}
      alert(msg);
    }
    setDownloading(false);
  };

  if (loading) return <div className="center" style={{ padding: '60px' }}><div className="spinner" /></div>;
  if (error) return <div className="card" style={{ textAlign: 'center', padding: '40px' }}><div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: '12px' }}>{error}</div><button className="btn btn-primary" onClick={load}>{t('refresh')}</button></div>;
  if (!data) return null;

  const rows = [
    { label: t('cashIncomeLabel'), value: data.cash_income, color: 'var(--green)', sign: '+' },
    { label: t('cashExpenseLabel'), value: data.cash_expense, color: 'var(--red)', sign: '−' },
    { label: t('cashBalanceLabel'), value: data.cash_balance, color: data.cash_balance >= 0 ? 'var(--primary)' : 'var(--red)', sign: '' },
    { label: t('salesRevenue'), value: data.sales_revenue, color: 'var(--primary)', sign: '+' },
    { label: t('salesCost'), value: data.sales_cost, color: 'var(--orange)', sign: '−' },
    { label: t('grossProfit'), value: data.gross_profit, color: data.gross_profit >= 0 ? 'var(--green)' : 'var(--red)', sign: '' },
  ];

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
      <div className="grid-3" style={{ marginBottom: '20px' }}>
        {rows.map(r => (
          <div className="stat-card" key={r.label} style={{ borderLeft: `4px solid ${r.color}` }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{r.label}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: r.color }}>
              {r.sign}{fmtNum(Math.abs(parseFloat(r.value)))}
              <span style={{ fontSize: '12px', marginLeft: '4px', color: 'var(--text2)', fontWeight: 400 }}>UZS</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: parseFloat(data.net_profit) >= 0 ? 'linear-gradient(135deg, #1e1b4b, #3730a3)' : 'linear-gradient(135deg, #7f1d1d, #dc2626)', borderRadius: '16px', padding: '28px 32px', color: '#fff' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, opacity: .7, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{t('netProfit')} ({t('netProfitDesc')})</div>
        <div className="mono" style={{ fontSize: '38px', fontWeight: 900 }}>
          {parseFloat(data.net_profit) >= 0 ? '+' : '−'}{fmtNum(Math.abs(parseFloat(data.net_profit)))}
          <span style={{ fontSize: '18px', marginLeft: '8px', opacity: .7, fontWeight: 400 }}>UZS</span>
        </div>
      </div>

      {/* Report download */}
      <div className="card" style={{ marginTop: '16px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>{t('reportPeriod')}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.4 }}>{t('reportHint')}</div>
          </div>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} compact />
          <button className="btn btn-primary" onClick={downloadReport} disabled={downloading}
                  style={{ minWidth: '210px', justifyContent: 'center' }}>
            {downloading ? t('downloadingReport') : t('downloadReport')}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '12px', textAlign: 'right' }}><button className="btn btn-ghost btn-sm" onClick={load}>{t('updateData')}</button></div>
    </div>
  );
}
