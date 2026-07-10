import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, AreaChart, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Средний чек по продавцу (operations).
// Источник: stock_outcome (status='approved') JOIN users (продавец = created_by).
// Чеки = COUNT, выручка = SUM(quantity*price) UZS, ср.чек = выручка/чеки.
// Лидер дня, gap-ratio (топ/худший), потенциал (вся команда = ср.чек лидера).
// Возвраты/план — прочерк, если источник отсутствует.

const PERIODS = [
  { value: '7',  label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
];

function rateBadge(ratio) {
  // ratio = ср.чек продавца / ср.чек лидера (0..1)
  if (ratio >= 0.9)  return { tone: 'green',  label: 'A' };
  if (ratio >= 0.7)  return { tone: 'blue',   label: 'B' };
  if (ratio >= 0.5)  return { tone: 'yellow', label: 'C' };
  return { tone: 'red', label: 'D' };
}

export default function SellerAvgCheckTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { days: period };
    if (branchId) params.branch_id = branchId;
    api.get('/operations/seller-avg-check', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const sellers = data?.sellers || [];
  const leader = data?.leader || null;
  const leaderAvg = data?.leader_avg_check || 0;
  const teamAvg = data?.team_avg_check || 0;
  const gapRatio = data?.gap_ratio || null;
  const totalRevenue = data?.total_revenue || 0;
  const totalChecks = data?.total_checks || 0;
  const trend = data?.trend || [];
  const potential = data?.potential || null;

  return (
    <>
      <PageHeader
        title={tt('🧾 Средний чек по продавцу')}
        sub={tt('Чеки · выручка · средний чек · лидер дня · потенциал команды')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : sellers.length === 0 ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📭</div><div>{tt('Нет продаж за период')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile
              icon="🏆" label={tt('Лидер')}
              value={leader ? leader.name : '—'}
              sub={leader && leader.plan_pct != null ? `${fmtNum(leader.plan_pct)}% ${tt('плана')}` : (leader ? `${fmtMoneyFull(leaderAvg)} ${tt('сум')}` : tt('нет данных'))}
              color="#16A34A"
            />
            <Tile
              icon="💳" label={tt('Ср. чек лидера')}
              value={`${fmtMoneyFull(leaderAvg)}`}
              sub={tt('сум')} color="var(--primary)"
            />
            <Tile
              icon="👥" label={tt('Ср. чек команды')}
              value={`${fmtMoneyFull(teamAvg)}`}
              sub={tt('сум')} color="#1D4ED8"
            />
            <Tile
              icon="📐" label={tt('Разрыв (gap)')}
              value={gapRatio != null ? `${gapRatio.toFixed(1)}x` : '—'}
              sub={tt('лидер / худший')} color="#D97706"
            />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="📊" title={tt('Итого · за период')}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Выручка')}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 900 }}>{fmtMoneyFull(totalRevenue)} <span style={{ fontSize: 13, color: 'var(--text3)' }}>{tt('сум')}</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Чеков')}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 900 }}>{fmtNum(totalChecks)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Продавцов')}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 900 }}>{fmtNum(sellers.length)}</div>
                </div>
              </div>
            </Card>

            {potential && (
              <Card icon="🚀" title={tt('Потенциал роста')}>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 10 }}>
                  {tt('Если вся команда выйдет на средний чек лидера')}
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Выручка сейчас')}</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoneyFull(totalRevenue)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Потенциал')}</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{fmtMoneyFull(potential.revenue_if_all_leader)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tt('Прирост')}</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>+{fmtMoneyFull(potential.uplift)}</div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {trend.length > 0 && (
            <Card icon="📈" title={tt('Динамика среднего чека по дням')} style={{ marginBottom: 16 }}>
              <AreaChart
                data={trend.map(t => t.avg_check)}
                labels={trend.map(t => t.label)}
                color="var(--primary)"
                height={170}
              />
            </Card>
          )}

          <Card icon="📋" title={`${tt('Сравнение продавцов')} (${sellers.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>{tt('Продавец')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Чеков')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Ср. чек')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Возвраты')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('% плана')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Оценка')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s, i) => {
                    const ratio = leaderAvg > 0 ? (s.avg_check / leaderAvg) : 0;
                    const rb = rateBadge(ratio);
                    const isLeader = leader && s.seller_id === leader.seller_id;
                    return (
                      <tr key={s.seller_id}>
                        <td style={{ fontWeight: 700 }}>
                          {isLeader && '👑 '}{s.name}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.checks)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: isLeader ? '#16A34A' : 'var(--text)' }}>{fmtMoneyFull(s.avg_check)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          {s.returns == null ? '—' : fmtNum(s.returns)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          {s.plan_pct == null ? '—' : `${fmtNum(s.plan_pct)}%`}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge tone={rb.tone}>{rb.label}</Badge>
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
