import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoney, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const TONE_META = {
  red:    { label: 'Низкая маржа',  badge: 'red',    sort: 0, hint: 'Маржа < 10% — поднять цену или поменять поставщика' },
  yellow: { label: 'Средняя маржа', badge: 'yellow', sort: 1, hint: 'Маржа 10-25% — пересмотреть стоимость закупки' },
  green:  { label: 'Здоровая маржа',badge: 'green',  sort: 2, hint: 'Маржа ≥ 25% — резерв для скидок и акций' },
};

const FILTERS = [
  { value: 'all',    label: 'Все' },
  { value: 'red',    label: '🔴 Низкая маржа' },
  { value: 'yellow', label: '🟡 Средняя' },
  { value: 'green',  label: '🟢 Здоровая' },
];

const SORTS = [
  { value: 'margin_asc',   label: 'Маржа ↑' },
  { value: 'margin_desc',  label: 'Маржа ↓' },
  { value: 'revenue_desc', label: 'Выручка ↓' },
];

export default function PricingTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('margin_asc');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/pricing/analyze', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const items = data?.items || [];
  const summary = data?.summary || {};

  const filtered = useMemo(() => {
    let xs = filter === 'all' ? items : items.filter(i => i.tone === filter);
    xs = [...xs].sort((a, b) => {
      if (sort === 'margin_asc') return a.margin_pct - b.margin_pct;
      if (sort === 'margin_desc') return b.margin_pct - a.margin_pct;
      return b.revenue_90d - a.revenue_90d;
    });
    return xs;
  }, [items, filter, sort]);

  return (
    <>
      <PageHeader
        title={tt('🏷️ Ценообразование')}
        sub={tt('Маржа по каждому товару · приоритет проблемных')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Всего товаров')} value={fmtNum(summary.total)} sub={`${tt('средняя маржа')} ${summary.avg_margin || 0}%`} color="#5B4FE8" />
            <Tile icon="🔴" label={tt('Низкая маржа')} value={fmtNum(summary.red)} sub={tt('< 10% — поднять цену')} color="#EF4444" />
            <Tile icon="🟡" label={tt('Средняя')}      value={fmtNum(summary.yellow)} sub="10-25%" color="#F59E0B" />
            <Tile icon="🟢" label={tt('Здоровая')}     value={fmtNum(summary.green)} sub="≥ 25%" color="#22C55E" />
          </div>

          <Card icon="📋" title={`${tt('Товары')} (${filtered.length})`}
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <Pills value={filter} onChange={setFilter} options={FILTERS.map(f => ({ ...f, label: tt(f.label) }))} />
                <Pills value={sort} onChange={setSort} options={SORTS.map(s => ({ ...s, label: tt(s.label) }))} />
              </div>
            }>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Закупка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Продажа')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Маржа')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Выручка 90д')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во 90д')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : filtered.slice(0, 300).map(it => {
                    const meta = TONE_META[it.tone];
                    return (
                      <tr key={it.id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoney(it.price_buy)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(it.price_sell)}</td>
                        <td className="mono" style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: it.tone === 'red' ? '#EF4444' : it.tone === 'yellow' ? '#F59E0B' : '#22C55E',
                        }}>{it.margin_pct}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge tone={meta.badge}>{tt(meta.label)}</Badge>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(it.revenue_90d)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtNum(it.qty_90d)} {it.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 300 && (
              <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                {tt('Показаны первые 300 из')} {filtered.length}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
