import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

export default function SupplierCompareTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузить список товаров (с историей закупок) + первый по умолчанию
  useEffect(() => {
    setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/compare', { params })
      .then(r => {
        const list = r.data?.products || [];
        setProducts(list);
        if (list.length && !productId) setProductId(String(list[0].id));
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => { if (!productId) setLoading(false); });
  }, [branchId]);

  // Загрузить сравнение по выбранному товару / периоду
  useEffect(() => {
    if (!productId) return;
    setLoading(true); setError(null);
    const params = { product_id: productId, period };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/compare', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [productId, period, branchId]);

  const suppliers = data?.suppliers || [];
  const best = data?.best || null;
  const current = data?.current || null;
  const savingMonth = data?.saving_month || 0;
  const savingYear = data?.saving_year || 0;
  const volume = data?.volume || 0;

  return (
    <>
      <PageHeader
        title={tt('⚖️ Сравнение цен поставщиков')}
        sub={tt('История закупочных цен по поставщикам · лучшая цена · экономия')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      <Card icon="🔍" title={tt('Выберите товар для сравнения')} style={{ marginBottom: 16 }}>
        {products.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: 6 }}>{tt('Нет товаров с историей закупок')}</div>
        ) : (
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            style={{
              width: '100%', maxWidth: 420, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600,
            }}
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name_ru}</option>
            ))}
          </select>
        )}
      </Card>

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !data || suppliers.length === 0 ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📭</div><div>{tt('Нет данных по поставщикам за период')}</div></div></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile
              icon="🏆"
              label={tt('Лучшая цена')}
              value={best ? fmtMoneyFull(best.min_price) : '—'}
              sub={best ? `${tt('сум')} · ${best.name}` : ''}
              color="#16A34A"
            />
            <Tile
              icon="📦"
              label={tt('Текущий поставщик')}
              value={current ? fmtMoneyFull(current.avg_price) : '—'}
              sub={current ? `${tt('сум')} · ${current.name}` : tt('нет данных')}
            />
            <Tile
              icon="💰"
              label={tt('Возможная экономия')}
              value={savingMonth > 0 ? `+${fmtMoneyFull(savingMonth)}` : '0'}
              sub={`${tt('сум в месяц при объёме')} ${fmtNum(volume)} ${tt('шт')}`}
              color={savingMonth > 0 ? '#16A34A' : 'var(--text)'}
            />
          </div>

          <Card icon="📊" title={`${tt('Сравнение поставщиков')} · ${data.product_name || ''}`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средняя цена')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Мин. цена')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Поставок')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Объём')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма закупок')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Отсрочка (дн)')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Оценка')}</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => {
                    const isBest = best && s.supplier_id === best.supplier_id;
                    return (
                      <tr key={s.supplier_id ?? s.name}>
                        <td style={{ fontWeight: 700 }}>
                          {s.name}
                          {isBest && <span style={{ marginLeft: 8 }}><Badge tone="green">{tt('лучшая')}</Badge></span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.avg_price)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: '#16A34A' }}>{fmtMoneyFull(s.min_price)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.income_count)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.total_qty)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(s.total_value)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{s.avg_deferral_days == null ? '—' : fmtNum(s.avg_deferral_days)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            background: isBest ? '#16A34A20' : 'var(--bg2, #F1F5F9)',
                            color: isBest ? '#16A34A' : 'var(--text2)',
                            padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12,
                          }}>
                            {isBest ? '★' : '·'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="💡" title={tt('Что важно учесть кроме цены')}>
            <div className="grid-3">
              <div style={{ padding: '4px 2px' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Потенциал экономии в год')}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: savingYear > 0 ? '#16A34A' : 'var(--text)' }}>
                  {savingYear > 0 ? `+${fmtMoneyFull(savingYear)}` : '0'} {tt('сум')}
                </div>
              </div>
              <div style={{ padding: '4px 2px' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Поставщиков по товару')}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 900 }}>{fmtNum(suppliers.length)}</div>
              </div>
              <div style={{ padding: '4px 2px' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Разброс цен')}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 900 }}>
                  {best ? fmtMoneyFull((data.max_price || best.min_price) - best.min_price) : '0'} {tt('сум')}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              {tt('Экономия рассчитана как разница средней цены текущего поставщика и лучшей цены, умноженная на месячный объём закупок.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
