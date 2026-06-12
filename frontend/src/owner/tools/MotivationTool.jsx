import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Progress, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';

// Мотивация = реальный лидерборд продаж за 30 дней.
// Конкурс «кто больше продал» работает из коробки на настоящих цифрах.
const MEDAL = ['🥇', '🥈', '🥉'];
const ROLE_RU = { seller: 'продавец', cashier: 'кассир', warehouse: 'складовщик', manager: 'менеджер', gen_dir: 'ген. директор', founder: 'учредитель' };

export default function MotivationTool() {
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

  const ranked = (data?.employees || []).filter(e => e.deals_30d > 0);
  const leader = ranked[0];
  const totalRevenue = ranked.reduce((a, e) => a + e.revenue_30d, 0);

  return (
    <>
      <PageHeader title="🏆 Мотивация" sub="Лидерборд продаж за 30 дней · реальные результаты" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : ranked.length === 0 ? (
        <Card><EmptyState icon="🏆" title="Пока нет участников" description="Лидерборд построится, как только сотрудники начнут продавать." /></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile icon="🥇" label="Лидер месяца" value={leader.name} sub={`${fmtMoneyFull(leader.revenue_30d)} сум`} color="#F59E0B" />
            <Tile icon="👥" label="Участников" value={fmtNum(ranked.length)} sub="продавали за 30 дней" color="#5B4FE8" />
            <Tile icon="💰" label="Общий результат" value={fmtMoneyFull(totalRevenue)} sub="сум · вся команда" color="#22C55E" />
          </div>

          <Card icon="🏁" title="Гонка продаж · 30 дней">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              {ranked.map((e, i) => {
                const pct = leader.revenue_30d > 0 ? Math.round((e.revenue_30d / leader.revenue_30d) * 100) : 0;
                const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={e.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <div style={{ width: 28, textAlign: 'center', fontSize: i < 3 ? 18 : 12, fontWeight: 800, color: 'var(--text3)' }}>
                        {MEDAL[i] || `${i + 1}`}
                      </div>
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{init}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{e.name}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text3)', marginLeft: 8 }}>
                          {ROLE_RU[e.role] || e.role} · {fmtNum(e.deals_30d)} продаж
                        </span>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, color: i === 0 ? '#F59E0B' : 'var(--text)' }}>
                        {fmtMoneyFull(e.revenue_30d)} <span style={{ fontSize: 10, color: 'var(--text3)' }}>сум</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 38 }}>
                      <Progress value={pct} max={100} color={i === 0 ? '#F59E0B' : i === 1 ? '#9094B0' : i === 2 ? '#B45309' : '#5B4FE8'} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14 }}>
              ℹ️ Полоса — % от результата лидера. Цифры обновляются с каждой продажей: готовый
              ежемесячный конкурс для команды. Детальные KPI — в разделе «KPI команды».
            </div>
          </Card>
        </>
      )}
    </>
  );
}
