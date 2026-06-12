import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';

const ROLE_RU = {
  founder: 'Учредитель', gen_dir: 'Ген. директор', manager: 'Менеджер',
  cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};
const ROLE_TONE = {
  founder: 'purple', gen_dir: 'purple', manager: 'blue',
  cashier: 'cyan', warehouse: 'orange', seller: 'green',
};

export default function HrTool() {
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/hr/overview', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const employees = data?.employees || [];
  const sellers = employees.filter(e => e.deals_30d > 0);
  const newHires = employees.filter(e => (Date.now() - new Date(e.hired_at)) / 86400000 < 60);

  const tenure = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days < 30) return `${days} дн`;
    if (days < 365) return `${Math.floor(days / 30)} мес`;
    return `${Math.floor(days / 365)} г ${Math.floor((days % 365) / 30)} мес`;
  };
  const lastActive = (iso) => {
    if (!iso) return '—';
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return 'сегодня';
    if (days === 1) return 'вчера';
    return `${days} дн назад`;
  };

  return (
    <>
      <PageHeader title="👤 Картотека HR" sub="Сотрудники компании · реальная активность" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : employees.length === 0 ? (
        <Card><EmptyState icon="👥" title="Сотрудников нет" description="Добавьте сотрудников в разделе «Сотрудники»." /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="👥" label="Всего в команде" value={fmtNum(employees.length)} sub="сотрудников" color="#9333EA" />
            <Tile icon="🛒" label="Продавали за 30 дней" value={fmtNum(sellers.length)} sub="активных" color="#22C55E" />
            <Tile icon="🆕" label="Новички" value={fmtNum(newHires.length)} sub="меньше 2 месяцев" color="#0EA5E9" />
            <Tile icon="💰" label="Продажи команды 30д" value={fmtMoneyFull(employees.reduce((a, e) => a + e.revenue_30d, 0))} sub="сум" color="#FF6B2B" />
          </div>

          <Card icon="🗂" title="Все сотрудники">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Роль</th>
                    <th>Филиал</th>
                    <th>Стаж</th>
                    <th style={{ textAlign: 'right' }}>Продаж 30д</th>
                    <th style={{ textAlign: 'right' }}>Выручка 30д</th>
                    <th>Активность</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={e.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{e.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge tone={ROLE_TONE[e.role] || 'gray'}>{ROLE_RU[e.role] || e.role}</Badge></td>
                        <td style={{ color: 'var(--text2)' }}>{e.branch || '—'}</td>
                        <td className="mono">{tenure(e.hired_at)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{e.deals_30d > 0 ? fmtNum(e.deals_30d) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{e.revenue_30d > 0 ? fmtMoneyFull(e.revenue_30d) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{lastActive(e.last_sale_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              ℹ️ Активность = продажи, проведённые сотрудником. Управление ролями и доступами — в разделе «Сотрудники».
            </div>
          </Card>
        </>
      )}
    </>
  );
}
