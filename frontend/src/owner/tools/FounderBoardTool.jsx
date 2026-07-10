import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';

// Цвета линий тренда прибыли по индексу филиала.
const FB_COLORS = ['#1D4ED8', '#EC4899', '#16A34A', '#D97706', '#0EA5E9', '#9333EA', '#DC2626', '#16A34A'];

const SEV_META = {
  critical: { icon: '🔴', tone: 'red',    color: '#DC2626', label: 'Критично' },
  warning:  { icon: '⚠️', tone: 'yellow', color: '#D97706', label: 'Внимание' },
  info:     { icon: 'ℹ️', tone: 'blue',   color: '#0EA5E9', label: 'Инфо' },
};

// YoY-дельта строкой (может быть null → нет базы прошлого года).
function YoY({ value }) {
  const { tt } = useTt();
  if (value == null) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>{tt('нет базы г/г')}</span>;
  const up = value >= 0;
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: up ? 'var(--green, #16A34A)' : 'var(--red, #DC2626)' }}>
      {up ? '▲' : '▼'} {fmtNum(Math.abs(value))}% {tt('г/г')}
    </span>
  );
}

// Мини мульти-линейный график прибыли по месяцам (inline SVG, прибыль может быть отрицательной).
function ProfitLines({ series, months }) {
  const { tt } = useTt();
  const W = 720, H = 210, padL = 8, padR = 8, padT = 12, padB = 26;
  const allVals = series.flatMap(s => s.points.map(p => p.profit));
  const max = Math.max(1, ...allVals);
  const min = Math.min(0, ...allVals);
  const span = (max - min) || 1;
  const n = months.length;
  const x = (i) => padL + (n <= 1 ? 0 : (i * (W - padL - padR) / (n - 1)));
  const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const zeroY = y(0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480 }}>
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={padT + (1 - g) * (H - padT - padB)} y2={padT + (1 - g) * (H - padT - padB)}
            stroke="var(--border, #E5E7EB)" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        {min < 0 && (
          <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--text3, #94A0B5)" strokeWidth="1" />
        )}
        {series.map((s, si) => {
          const color = FB_COLORS[si % FB_COLORS.length];
          const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.profit).toFixed(1)}`).join(' ');
          return (
            <g key={s.branch_id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.profit)} r="3" fill={color} />)}
            </g>
          );
        })}
        {months.map((m, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text3, #94A0B5)">{m.slice(5)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        {series.map((s, si) => (
          <div key={s.branch_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: FB_COLORS[si % FB_COLORS.length] }} />
            {s.branch_name}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text3)' }}>{tt('Прибыль = выручка − себестоимость продаж, по месяцам')}</div>
    </div>
  );
}

export default function FounderBoardTool() {
  const { tt } = useTt();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.get('/analytics/founder-dashboard')
      .then(r => { if (alive) setData(r.data); })
      .catch(e => { if (alive) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const ct = data?.company_totals || {};
  const branches = data?.branches || [];
  const alerts = data?.alerts || [];
  const asum = data?.alerts_summary || { critical: 0, warning: 0, total: 0 };
  const trend = data?.profit_trend || { months: [], series: [] };

  return (
    <>
      <PageHeader
        title={tt('👑 Дашборд учредителя')}
        sub={tt('Сводка компании · филиалы · алерты · динамика прибыли (текущий месяц)')}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={56} /></Card>)}
          </div>
          <Card><Skeleton height={140} /></Card>
        </>
      ) : !data ? (
        <Card><EmptyState icon="📭" title={tt('Нет данных')} description={tt('Дашборд недоступен')} /></Card>
      ) : branches.length === 0 ? (
        <Card><EmptyState icon="🏢" title={tt('Нет филиалов')} description={tt('Добавьте филиалы компании')} /></Card>
      ) : (
        <>
          {/* Сводка компании */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка')} color="#1D4ED8"
              value={fmtMoney(ct.revenue)} sub={<YoY value={ct.revenue_yoy} />} />
            <Tile icon="📈" label={tt('Чистая прибыль')} color={ct.profit >= 0 ? '#16A34A' : '#DC2626'}
              value={fmtMoney(ct.profit)} sub={<YoY value={ct.profit_yoy} />} />
            <Tile icon="👥" label={tt('Клиентов')} color="#0EA5E9"
              value={fmtNum(ct.customers)} sub={`+${fmtNum(ct.new_customers)} ${tt('новых')}`} />
            <Tile icon="🧑‍💼" label={tt('Сотрудников')} color="#D97706"
              value={fmtNum(ct.employees)} sub={`${tt('Маржа')} ${fmtNum(ct.margin)}%`} />
          </div>

          {/* Таблица по филиалам */}
          <Card icon="🏭" title={tt('Филиалы')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Филиал')}</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>BHI</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Выручка')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Прибыль')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Маржа')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Клиенты')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Штат')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Главная проблема')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(b => (
                    <tr key={b.id} style={{ borderTop: '1px solid var(--border, #EEF0F4)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700 }}>{b.name}</td>
                      <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 13.5, fontWeight: 800 }}>
                        {b.bhi != null ? b.bhi : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13.5, fontWeight: 600 }}>{fmtMoney(b.revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13.5, fontWeight: 600, color: b.profit >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoney(b.profit)}</td>
                      <td className="mono" style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13.5, fontWeight: 700, color: b.margin_red ? 'var(--red, #DC2626)' : 'var(--text)' }}>
                        {fmtNum(b.margin)}%{b.margin_red ? ' 🔴' : ''}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13.5 }}>{fmtNum(b.customers)}</td>
                      <td className="mono" style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13.5 }}>{fmtNum(b.employees)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12.5, color: b.top_issue ? 'var(--text2)' : 'var(--text3)' }}>
                        {b.top_issue ? <Badge tone="yellow">{b.top_issue}</Badge> : tt('—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.bhi_company != null && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                {tt('BHI — единый индекс здоровья по компании (не разбивается по филиалам). Красная маржа — ниже нормы 20%.')}
              </div>
            )}
          </Card>

          {/* Панель алертов учредителя */}
          <Card
            icon="🚨"
            title={tt('Требует внимания')}
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                {asum.critical > 0 && <Badge tone="red">{asum.critical} 🔴</Badge>}
                {asum.warning > 0 && <Badge tone="yellow">{asum.warning} ⚠️</Badge>}
              </div>
            }
            style={{ marginBottom: 16 }}
          >
            {alerts.length === 0 ? (
              <EmptyState icon="✅" title={tt('Всё спокойно')} description={tt('Активных алертов нет')} />
            ) : (
              <div className="list">
                {alerts.map(a => {
                  const meta = SEV_META[a.severity] || SEV_META.info;
                  return (
                    <div key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: meta.color }} />
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div className="list-item-title">{a.title}</div>
                          <Badge tone={meta.tone}>{tt(meta.label)}</Badge>
                          {a.branch_name && <Badge tone="blue">{a.branch_name}</Badge>}
                        </div>
                        {a.description && <div className="list-item-sub" style={{ marginTop: 3 }}>{a.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Динамика прибыли по филиалам */}
          <Card icon="📊" title={`${tt('Динамика прибыли')} · ${tt('6 месяцев')}`}>
            {trend.series.length > 0 && trend.months.length > 0 ? (
              <ProfitLines series={trend.series} months={trend.months} />
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>{tt('Нет данных по прибыли за период')}</div>
            )}
          </Card>
        </>
      )}
    </>
  );
}