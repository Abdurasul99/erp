import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { formatDate, fmtMoney } from '../utils.js';

export default function CashBalance() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/cash/balance');
    setData(data);
    setLoading(false);
  };

  if (loading) return <div className="center" style={{ padding: '60px' }}><div className="spinner" /></div>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="grid-3" style={{ marginBottom: '20px', flexShrink: 0 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{fmtMoney(data.total_income)}</div>
          <div className="stat-label">{t('totalIncome')}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--red)' }}>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{fmtMoney(data.total_expense)}</div>
          <div className="stat-label">{t('totalExpense')}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${data.balance >= 0 ? 'var(--primary)' : 'var(--red)'}` }}>
          <div className="stat-value" style={{ color: data.balance >= 0 ? 'var(--primary)' : 'var(--red)' }}>
            {fmtMoney(data.balance)}
          </div>
          <div className="stat-label">{t('totalBalance')}</div>
        </div>
      </div>

      <div className="grid-2" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="section-title" style={{ color: 'var(--green)', flexShrink: 0 }}>💵 {t('income')}</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>{t('amount')}</th><th>{t('description')}</th><th>{t('date')}</th></tr>
              </thead>
              <tbody>
                {(data.income_list || []).map(item => (
                  <tr key={item.id}>
                    <td><span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>+{fmtMoney(item.amount)}</span></td>
                    <td style={{ fontSize: '13px' }}>{item.description || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="section-title" style={{ color: 'var(--red)', flexShrink: 0 }}>💸 {t('outcome')}</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>{t('amount')}</th><th>{t('description')}</th><th>{t('date')}</th></tr>
              </thead>
              <tbody>
                {(data.expense_list || []).map(item => (
                  <tr key={item.id}>
                    <td><span className="mono" style={{ fontWeight: 700, color: 'var(--red)' }}>−{fmtMoney(item.amount)}</span></td>
                    <td style={{ fontSize: '13px' }}>{item.description || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
