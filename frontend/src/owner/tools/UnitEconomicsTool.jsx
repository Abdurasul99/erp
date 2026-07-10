import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Pills, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Тон Badge по статусу бенчмарка.
const STAT = {
  good: { tone: 'green', icon: '✅', label: 'Норма' },
  warn: { tone: 'orange', icon: '⚠️', label: 'Внимание' },
  bad:  { tone: 'red', icon: '❌', label: 'Низко' },
  na:   { tone: 'gray', icon: '–', label: 'Нет данных' },
};

const PERIODS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

const dash = '—';

function StatusBadge({ status, tt }) {
  const s = STAT[status] || STAT.na;
  return <Badge tone={s.tone}>{s.icon} {tt(s.label)}</Badge>;
}

// Метрика-плитка: значение + бенчмарк + статус.
function MetricTile({ icon, label, value, sub, status, color, tt }) {
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{icon} {tt(label)}</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: color || 'var(--text1)' }} className="mono">{value}</div>
            {sub && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{tt(sub)}</div>}
          </div>
          {status && <StatusBadge status={status} tt={tt} />}
        </div>
      </div>
    </Card>
  );
}

export default function UnitEconomicsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/unit-economics', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const c = data?.customer;
  const tr = data?.transaction;
  const prod = data?.product || [];
  const sqm = data?.sqm || [];
  const ads = data?.ads;

  return (
    <>
      <PageHeader
        title={tt('🧮 Юнит-экономика')}
        sub={tt('Прибыльность на единицу · клиент · сделка · товар · м² · реклама')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !data ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📊</div><div>{tt('Нет данных')}</div></div></Card>
      ) : (
        <>
          {/* Уровень 1: Экономика клиента */}
          <Card icon="👤" title={tt('Экономика клиента')} style={{ marginBottom: 16 }}>
            <div className="grid-4">
              <MetricTile icon="💸" label="CAC (привлечение)" tt={tt} status={c.status.cac}
                value={c.cac !== null ? fmtMoney(c.cac) : dash} sub="Бенчмарк < 50 000" />
              <MetricTile icon="💎" label="LTV (ценность)" tt={tt} status={c.status.ltv}
                value={fmtMoney(c.ltv)} sub="Бенчмарк > 100 000" />
              <MetricTile icon="⚖️" label="LTV / CAC" tt={tt} status={c.status.ltv_cac}
                value={c.ltv_cac_ratio !== null ? `${c.ltv_cac_ratio}x` : dash} sub="Бенчмарк > 3x" />
              <MetricTile icon="⏳" label="Окупаемость CAC" tt={tt} status={c.status.payback}
                value={c.payback_months !== null ? `${c.payback_months} ${tt('мес')}` : dash} sub="Бенчмарк < 6 мес" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('Новых клиентов за период')}: <b>{fmtNum(c.new_customers)}</b> · {tt('расход на привлечение')}: <b>{fmtMoney(c.total_spend)}</b> UZS
            </div>

            {c.by_channel.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Канал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Расход')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Новых')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('CAC')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Эффективность')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.by_channel.map(ch => (
                      <tr key={ch.channel}>
                        <td style={{ fontWeight: 700 }}>{tt(ch.label)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{ch.spend ? fmtMoney(ch.spend) : dash}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(ch.new_customers)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{ch.cac !== null && ch.cac > 0 ? fmtMoney(ch.cac) : dash}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(ch.revenue)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge tone={ch.efficiency === 'Дорого' ? 'red' : ch.efficiency === 'Бесплатно' ? 'gray' : 'green'}>{tt(ch.efficiency)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Уровень 2: Экономика сделки */}
          <Card icon="🧾" title={tt('Экономика сделки')} style={{ marginBottom: 16 }}>
            <div className="grid-4">
              <MetricTile icon="🧾" label="Средний чек" tt={tt} status={tr.status.avg_check}
                value={fmtMoney(tr.avg_check)} sub="Бенчмарк > 20 000" />
              <MetricTile icon="📦" label="COGS на чек" tt={tt}
                value={fmtMoney(tr.avg_cogs)} />
              <MetricTile icon="📊" label="Валовая маржа" tt={tt} status={tr.status.margin}
                value={`${tr.gross_margin_pct}%`} sub="Бенчмарк > 40%" />
              <MetricTile icon="💰" label="Прибыль на чек" tt={tt}
                value={fmtMoney(tr.net_profit_per_check)} sub="Валовая (без аллокации)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('Чеков за период')}: <b>{fmtNum(tr.deals)}</b>
            </div>
          </Card>

          {/* Уровень 6: Экономика рекламы */}
          <Card icon="📣" title={tt('Экономика рекламы')} style={{ marginBottom: 16 }}>
            <div className="grid-4">
              <MetricTile icon="💸" label="Расход на рекламу" tt={tt}
                value={ads.total_spend ? fmtMoney(ads.total_spend) : dash} />
              <MetricTile icon="📈" label="ROAS (валовый)" tt={tt} status={ads.status.roas}
                value={ads.roas !== null ? `${ads.roas}x` : dash} sub="Бенчмарк > 5x" />
              <MetricTile icon="🟢" label="Net ROAS" tt={tt} status={ads.status.net_roas}
                value={ads.net_roas !== null ? `${ads.net_roas}x` : dash} sub="Бенчмарк > 2x" />
              <MetricTile icon="⏱️" label="Окупаемость" tt={tt}
                value={ads.payback_days !== null ? `${ads.payback_days} ${tt('дн')}` : dash} />
            </div>
            {ads.total_spend === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                {tt('Нет расходов по рекламным каналам за период. Заполните «Каналы и ROI» → расход.')}
              </div>
            )}
          </Card>

          {/* Уровень 4: Экономика на м² */}
          <Card icon="📐" title={tt('Экономика на м²')} style={{ marginBottom: 16 }}>
            {sqm.every(b => !b.area) ? (
              <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                {tt('Площадь филиалов не задана. Владелец задаёт её через PATCH /api/branches/:id/area (area_sqm, rent_monthly_uzs).')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Филиал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Площадь, м²')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка/м²')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прибыль/м²')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Аренда/м²')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sqm.map(b => (
                      <tr key={b.branch_id}>
                        <td style={{ fontWeight: 700 }}>{b.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.area ? fmtNum(b.area) : dash}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.status.revenue === 'good' ? 'var(--green,#16A34A)' : b.status.revenue === 'bad' ? 'var(--red,#DC2626)' : undefined }}>
                          {b.revenue_per_sqm !== null ? fmtMoney(b.revenue_per_sqm) : dash}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.profit_per_sqm !== null ? fmtMoney(b.profit_per_sqm) : dash}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.rent_per_sqm !== null ? fmtMoney(b.rent_per_sqm) : dash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  {tt('Бенчмарк: выручка/м² > 50 000 · прибыль/м² > 10 000 · аренда/м² < 15 000')}
                </div>
              </div>
            )}
          </Card>

          {/* Уровень 5: Экономика на час — нет данных */}
          <Card icon="⏰" title={tt('Экономика на час')} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
              {tt('Рабочие часы филиалов не отслеживаются — метрики выручка/час и точка безубыточности по часам недоступны.')} {dash}
            </div>
          </Card>

          {/* Уровень 3: Экономика товара */}
          <Card icon="🏷️" title={tt('Экономика товара (ROI · мёртвый сток)')} style={{ marginBottom: 16 }}>
            {prod.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{tt('Нет товаров')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Себест.')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Цена')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Маржа')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('ROI')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Продано')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прибыль')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prod.slice(0, 50).map(p => (
                      <tr key={p.id} style={p.dead_stock ? { opacity: 0.7 } : undefined}>
                        <td style={{ fontWeight: 700 }}>
                          {p.name}
                          {p.dead_stock && <span style={{ marginLeft: 8 }}><Badge tone="red">{tt('мёртв. сток!')}</Badge></span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(p.cost)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(p.price)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{p.margin_pct}%</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{p.roi !== null ? `${p.roi}%` : dash}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(p.monthly_qty)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(p.monthly_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('CAC = расход канала за период / новых клиентов. LTV = средний total_spent активных клиентов (RFM). LTV/CAC > 3x — здоровая модель. ROAS = выручка рекл.каналов / расход; Net ROAS = валовая прибыль / расход. Рабочие часы не отслеживаются.')}
          </div>
        </>
      )}
    </>
  );
}