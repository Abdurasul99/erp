import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Программа лояльности: tier-кэшбек по покупкам.
// Стандарт → Золото → Платина. Баллы начисляются от суммы покупок (stock_outcome).
const TIER_META = {
  standard: { icon: '🥈', label: 'Стандарт', color: '#64748B' },
  gold:     { icon: '🥇', label: 'Золото',   color: '#D97706' },
  platinum: { icon: '💎', label: 'Платина',  color: '#7C3AED' },
};

const tierMeta = (t) => TIER_META[t] || TIER_META.standard;

export default function LoyaltyPointsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [overview, setOverview] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    Promise.all([
      api.get('/marketing/loyalty/overview', { params }),
      api.get('/marketing/loyalty/tiers', { params }),
      api.get('/marketing/loyalty/top', { params }),
    ])
      .then(([o, ti, tp]) => {
        setOverview(o.data || {});
        setTiers(ti.data?.tiers || []);
        setTop(tp.data?.customers || []);
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const o = overview || {};
  const isEmpty = !loading && !error && (o.members || 0) === 0 && top.length === 0;

  return (
    <>
      <PageHeader
        title={tt('🎁 Программа лояльности')}
        sub={tt('Tier-кэшбек · баллы · топ-участники')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : isEmpty ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">🎁</div><div>{tt('Нет участников программы')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="👥" label={tt('Участники программы')} value={fmtNum(o.members || 0)} sub={tt('зарегистрировано')} color="#1D4ED8" />
            <Tile icon="🎯" label={tt('Начислено баллов')} value={fmtNum(o.points_issued || 0)} sub={tt('за всё время')} color="#16A34A" />
            <Tile icon="💸" label={tt('Списано баллов')} value={fmtNum(o.points_redeemed || 0)} sub={`${fmtMoneyFull((o.points_redeemed || 0) * 10)} ${tt('сум')}`} color="#D97706" />
            <Tile icon="💳" label={tt('Активные карты')} value={fmtNum(o.active_members || 0)} sub={tt('покупали за месяц')} color="#7C3AED" />
          </div>

          <Card icon="🎯" title={tt('Уровни программы')} style={{ marginBottom: 16 }}>
            <div className="grid-3">
              {tiers.length === 0 ? (
                <div style={{ color: 'var(--text3)', padding: 20 }}>{tt('Нет данных')}</div>
              ) : tiers.map(t => {
                const m = tierMeta(t.tier);
                return (
                  <div key={t.tier} className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${m.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 24 }}>{m.icon}</span>
                      <div style={{ fontWeight: 800, fontSize: 15, color: m.color }}>{tt(m.label)}</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900 }}>{fmtNum(t.members || 0)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{tt('участников')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                      <div>{t.rate} {tt('балл на 1 000 сум')}</div>
                      <div>{t.range}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card icon="🏆" title={`${tt('Топ-участники')} (${top.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Клиент')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Уровень')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Баланс баллов')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Потрачено')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {top.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет участников')}</td></tr>
                  ) : top.slice(0, 100).map(c => {
                    const m = tierMeta(c.tier);
                    return (
                      <tr key={c.customer_id}>
                        <td style={{ fontWeight: 700 }}>{c.name || tt('Аноним')}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: m.color + '20', color: m.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {m.icon} {tt(m.label)}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(c.points_balance || 0)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(c.total_spent || 0)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {c.active
                            ? <Badge tone="green">{tt('Активный')}</Badge>
                            : <Badge tone="gray">{tt('Спящий')}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
