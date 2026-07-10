import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Progress, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Классы оборачиваемости: цвет + подпись.
const CLASS_META = {
  fast:   { color: '#16A34A', label: 'Быстрый' },
  normal: { color: '#1D4ED8', label: 'Норма' },
  slow:   { color: '#D97706', label: 'Медленный' },
  dead:   { color: '#DC2626', label: 'Мёртвый' },
};

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const TABS = [
  { value: 'all',    label: 'Все' },
  { value: 'fast',   label: 'Быстрый' },
  { value: 'normal', label: 'Норма' },
  { value: 'slow',   label: 'Медленный' },
  { value: 'dead',   label: 'Мёртвый' },
];

function ClassBadge({ cls }) {
  const { tt } = useTt();
  const meta = CLASS_META[cls] || CLASS_META.normal;
  return (
    <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
      {tt(meta.label)}
    </span>
  );
}

export default function TurnoverDeadstockTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/turnover', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const items = data?.items || [];
  const dead = data?.dead || [];
  const summary = data?.summary || {};

  const filtered = tab === 'all' ? items : items.filter(i => i.turnover_class === tab);

  return (
    <>
      <PageHeader
        title={tt('🔄 Оборачиваемость и мёртвый сток')}
        sub={tt('Скорость оборота товара · замороженный капитал · товары без движения 90 дней')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="⏱️" label={tt('Средняя оборачиваемость')} value={`${fmtNum(summary.avg_turnover_days || 0)} ${tt('дн')}`} sub={tt('по продающимся товарам')} color="#1D4ED8" />
            <Tile icon="⚡" label={tt('Быстрые (≤7 дн)')} value={fmtNum(summary.fast_count || 0)} sub={tt('SKU')} color="#16A34A" />
            <Tile icon="🐢" label={tt('Медленные (7–30 дн)')} value={fmtNum(summary.slow_count || 0)} sub={tt('SKU')} color="#D97706" />
            <Tile icon="💀" label={tt('Мёртвый сток (>90 дн)')} value={fmtNum(summary.dead_count || 0)} sub={tt('кандидаты на ликвидацию')} color="#DC2626" />
          </div>

          <Card icon="🧊" title={tt('Замороженный капитал')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#DC2626' }} className="mono">{fmtMoneyFull(summary.frozen_sum || 0)}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 700 }}>{tt('сум')}</div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6 }}>
              {tt('заморожено в товарах без продаж')} · {fmtNum(summary.dead_count || 0)} {tt('товаров')}
            </div>
          </Card>

          <Card icon="💀" title={`${tt('Мёртвый сток')} (${dead.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Остаток')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Заморожено')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Дней без движения')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dead.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Мёртвого стока нет')}</td></tr>
                  ) : dead.slice(0, 200).map(it => (
                    <tr key={it.product_id}>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)} {it.unit}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{fmtMoneyFull(it.frozen_sum)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{it.days_since_last_movement == null ? '—' : fmtNum(it.days_since_last_movement)}</td>
                      <td style={{ textAlign: 'center' }}><ClassBadge cls="dead" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Оборачиваемость товаров')} (${filtered.length})`} actions={<Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний остаток')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Продано')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Оборачиваемость, дн')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Класс')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : filtered.slice(0, 200).map(it => (
                    <tr key={it.product_id}>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.avg_stock)} {it.unit}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.sales_qty)} {it.unit}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{it.turnover_days == null ? '—' : fmtNum(it.turnover_days)}</td>
                      <td style={{ textAlign: 'center' }}><ClassBadge cls={it.turnover_class} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
