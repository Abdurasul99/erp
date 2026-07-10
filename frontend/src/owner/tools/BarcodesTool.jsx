import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Progress, Skeleton, EmptyState, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Штрихкоды и QR — покрытие SKU кодами (read-only).
// Источник: GET /api/warehouse/barcodes-coverage.
const FILTERS = [
  { value: 'all',     label: 'Все' },
  { value: 'coded',   label: 'С кодом' },
  { value: 'nocode',  label: 'Без кода' },
];

export default function BarcodesTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/barcodes-coverage', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const total = data?.total || 0;
  const withBarcode = data?.with_barcode || 0;
  const without = data?.without_barcode || 0;
  const pct = data?.coverage_pct || 0;
  const items = data?.items || [];

  const filtered = filter === 'all'
    ? items
    : filter === 'coded'
      ? items.filter(i => i.has_barcode)
      : items.filter(i => !i.has_barcode);

  return (
    <>
      <PageHeader
        title={tt('🏷️ Штрихкоды и QR')}
        sub={tt('Покрытие товаров кодами · EAN-13 · QR для склада')}
        actions={<Badge tone="green">{tt('Только просмотр')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={48} /></Card>)}
          </div>
          <Card><Skeleton height={200} /></Card>
        </>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon="🏷️"
            title={tt('Нет товаров')}
            description={tt('Добавьте товары, чтобы отслеживать покрытие штрихкодами.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Всего товаров')} value={fmtNum(total)} sub={tt('активные SKU')} color="var(--primary)" />
            <Tile icon="✅" label={tt('С кодом')} value={fmtNum(withBarcode)} sub={tt('есть штрихкод')} color="#16A34A" />
            <Tile icon="⚠️" label={tt('Без кода')} value={fmtNum(without)} sub={tt('требуют присвоения')} color="#DC2626" />
            <Tile icon="📊" label={tt('Покрытие')} value={`${pct}%`} sub={tt('доля с кодом')} color="#1D4ED8" />
          </div>

          <Card icon="📈" title={tt('Покрытие штрихкодами')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1D4ED8' }} className="mono">{pct}%</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {fmtNum(withBarcode)} {tt('из')} {fmtNum(total)} {tt('товаров имеют код')}
              </div>
            </div>
            <Progress value={pct} max={100} color={pct >= 90 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626'} />
          </Card>

          <Card
            icon="📋"
            title={`${tt('Товары')} (${filtered.length})`}
            actions={
              <div className="pills" role="group">
                {FILTERS.map(f => (
                  <button key={f.value} type="button"
                    className={'pill' + (f.value === filter ? ' active' : '')}
                    aria-pressed={f.value === filter}
                    onClick={() => setFilter(f.value)}>{tt(f.label)}</button>
                ))}
              </div>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>{tt('Товар')}</th>
                    <th>{tt('Штрихкод')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Остаток')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : filtered.slice(0, 300).map(it => (
                    <tr key={it.product_id}>
                      <td className="mono" style={{ color: 'var(--text2)', fontSize: 12 }}>#{it.product_id}</td>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {it.has_barcode
                          ? it.barcode
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)} {it.unit}</td>
                      <td style={{ textAlign: 'center' }}>
                        {it.has_barcode
                          ? <span style={{ background: '#16A34A20', color: '#16A34A', padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>{tt('Готов')}</span>
                          : <span style={{ background: '#DC262620', color: '#DC2626', padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>{tt('Без кода')}</span>}
                      </td>
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
