import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoney, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// 3×3 matrix: rows = A/B/C (revenue), cols = X/Y/Z (demand stability).
// AX = stable cash cow → keep stocked. CZ = dead stock → liquidate.
const CELL_META = {
  AX: { color: '#16A34A', advice: 'Cash cow — держать запас, частые поставки' },
  AY: { color: '#1D4ED8', advice: 'Стабильный лидер с колебаниями — буфер 20%' },
  AZ: { color: '#0EA5E9', advice: 'Сезонник, который много даёт — прогноз' },
  BX: { color: '#16A34A', advice: 'Стабильный середняк — оптимизировать запас' },
  BY: { color: '#D97706', advice: 'Умеренный · средняя предсказуемость' },
  BZ: { color: '#D97706', advice: 'Непредсказуемый середняк — гибкий запас' },
  CX: { color: '#0EA5E9', advice: 'Стабильный хвост — минимальный запас' },
  CY: { color: '#D97706', advice: 'Низкий вклад · средние колебания' },
  CZ: { color: '#DC2626', advice: 'Мёртвый товар — ликвидация со скидкой' },
};

const TABS = [
  { value: 'all', label: 'Все' },
  { value: 'A',   label: 'A' },
  { value: 'B',   label: 'B' },
  { value: 'C',   label: 'C' },
];

export default function InventoryMgmtTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/inventory/abc-xyz', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const items = data?.items || [];
  const matrix = data?.matrix || {};
  const totalRev = data?.total_revenue || 0;

  const filtered = tab === 'all' ? items : items.filter(i => i.abc === tab);

  return (
    <>
      <PageHeader
        title={tt('📊 ABC / XYZ анализ')}
        sub={tt('Топ-товары по выручке · точка заказа · мёртвый товар (90 дн)')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏆" label={tt('Группа A')} value={fmtNum((matrix.AX?.count || 0) + (matrix.AY?.count || 0) + (matrix.AZ?.count || 0))} sub={tt('80% выручки')} color="#16A34A" />
            <Tile icon="📈" label={tt('Группа B')} value={fmtNum((matrix.BX?.count || 0) + (matrix.BY?.count || 0) + (matrix.BZ?.count || 0))} sub={tt('15% выручки')} color="#1D4ED8" />
            <Tile icon="📉" label={tt('Группа C')} value={fmtNum((matrix.CX?.count || 0) + (matrix.CY?.count || 0) + (matrix.CZ?.count || 0))} sub={tt('5% выручки')}  color="#D97706" />
            <Tile icon="💀" label={tt('Мёртвые (CZ)')} value={fmtNum(matrix.CZ?.count || 0)} sub={tt('кандидаты на ликвидацию')} color="#DC2626" />
          </div>

          <Card icon="🎯" title={tt('Матрица ABC × XYZ')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th style={{ textAlign: 'center' }}>{tt('X — стабильный спрос')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Y — средние колебания')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Z — нестабильный')}</th>
                  </tr>
                </thead>
                <tbody>
                  {['A', 'B', 'C'].map(row => (
                    <tr key={row}>
                      <td style={{ fontWeight: 800, fontSize: 14 }}>{row} — {row === 'A' ? tt('топ выручки') : row === 'B' ? tt('средние') : tt('хвост')}</td>
                      {['X', 'Y', 'Z'].map(col => {
                        const cell = row + col;
                        const meta = CELL_META[cell] || {};
                        const data = matrix[cell] || { count: 0, revenue: 0 };
                        return (
                          <td key={col} style={{ background: meta.color + '14', padding: 14, textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: meta.color }} className="mono">{data.count}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{tt('товаров')}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 4 }}>{fmtMoney(data.revenue)} UZS</div>
                            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 6, lineHeight: 1.3 }}>{tt(meta.advice)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Товары')} (${filtered.length})`} actions={<Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'center' }}>ABC × XYZ</th>
                    <th style={{ textAlign: 'right' }}>{tt('Выручка 90д')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                    <th style={{ textAlign: 'right' }}>CoV</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : filtered.slice(0, 200).map(it => {
                    const meta = CELL_META[it.cell] || {};
                    return (
                      <tr key={it.product_id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                            {it.cell}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(it.revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.qty)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)', fontSize: 12 }}>
                          {it.cov == null ? '—' : it.cov.toFixed(2)}
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
