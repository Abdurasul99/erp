import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Поля калькулятора «что если» — СТРОКИ: в onChange только чистка символов,
// нормализация — на blur. type="number" ломал ввод: Chrome на промежуточно-невалидном
// вводе («12 500», «12,5») отдаёт e.target.value === '', поле само себя стирало и весь
// расчёт ROI показывал нули при заполненных на вид полях.
const cleanNum = (s) => String(s).replace(/[^\d.,]/g, '');
// Строка → число (>= 0). Пусто и мусор дают 0, поэтому в итогах NaN не появляется.
const toNum = (s) => {
  const n = parseFloat(normalizeDecimal(s));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Performance tiers by ROI% — best → worst.
function roiTier(roi) {
  if (roi == null) return { key: 'na',   icon: '—',  label: 'Нет данных', color: 'var(--text3)' };
  if (roi >= 120)  return { key: 'best', icon: '🏆', label: 'Лучший',     color: '#16A34A' };
  if (roi >= 60)   return { key: 'good', icon: '✅', label: 'Отлично',    color: '#1D4ED8' };
  if (roi >= 25)   return { key: 'ok',   icon: '✅', label: 'Хорошо',     color: '#0EA5E9' };
  if (roi >= 5)    return { key: 'weak', icon: '⚠', label: 'Слабо',      color: '#D97706' };
  return { key: 'bad', icon: '⚠', label: 'Плохо', color: '#DC2626' };
}

export default function PurchaseRoiTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  // What-if calculator (client-only).
  const [wBuy, setWBuy] = useState('');
  const [wSell, setWSell] = useState('');
  const [wQty, setWQty] = useState('');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/purchase-roi', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const items = data?.items || [];

  const whatIf = useMemo(() => {
    const buy = toNum(wBuy);
    const sell = toNum(wSell);
    const qty = toNum(wQty);
    const invest = buy * qty;
    const revenue = sell * qty;
    const profit = revenue - invest;
    const roi = invest > 0 ? (profit / invest) * 100 : null;
    return { invest, revenue, profit, roi };
  }, [wBuy, wSell, wQty]);

  // Приводим значение к виду только при уходе фокуса: пустое остаётся пустым (поле можно
  // полностью очистить и стереть первую цифру), «12,5» → «12.5», мусор → пусто.
  const normOnBlur = (val, set) => {
    if (val === '') return;
    const n = toNum(val);
    set(n > 0 ? String(n) : '');
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--border, #E3EAF3)', fontSize: 13,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <>
      <PageHeader
        title={tt('💹 ROI закупки')}
        sub={tt('Возврат на вложения по каждому товару · что-если перед закупкой')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={48} /></Card>)}
          </div>
          <Card><Skeleton height={200} /></Card>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Вложено')}  value={fmtMoneyFull(data?.total_cost || 0)}    sub={tt('сум закупки')}  color="#1D4ED8" />
            <Tile icon="📈" label={tt('Выручка')}  value={fmtMoneyFull(data?.total_revenue || 0)} sub={tt('сум продаж')}    color="#0EA5E9" />
            <Tile icon="🟢" label={tt('Прибыль')}  value={fmtMoneyFull(data?.total_profit || 0)}  sub={tt('сум')}           color="#16A34A" />
            <Tile icon="💹" label={tt('Общий ROI')} value={data?.total_roi == null ? '—' : `${Math.round(data.total_roi)}%`} sub={tt('за период')} color={roiTier(data?.total_roi).color} />
          </div>

          <Card icon="📋" title={`${tt('Возврат на вложения по каждому товару')} (${items.length})`}>
            {items.length === 0 ? (
              <EmptyState
                icon="📦"
                title={tt('Нет продаж за период')}
                description={tt('Выберите другой период или дождитесь первых продаж')}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Закуплено на')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прибыль')}</th>
                      <th style={{ textAlign: 'right' }}>ROI %</th>
                      <th style={{ textAlign: 'center' }}>{tt('Оценка')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => {
                      const tier = roiTier(it.roi);
                      return (
                        <tr key={it.product_id}>
                          <td style={{ fontWeight: 700 }}>{it.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(it.purchase_cost)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(it.revenue)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: it.profit >= 0 ? '#16A34A' : '#DC2626' }}>
                            {fmtMoneyFull(it.profit)}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: tier.color }}>
                            {it.roi == null ? '—' : `${it.roi >= 0 ? '+' : ''}${Math.round(it.roi)}%`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: tier.color + '20', color: tier.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                              {tier.icon} {tt(tier.label)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🤔" title={tt('Что если — считаем ROI перед закупкой')} style={{ marginTop: 16 }}>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>{tt('Цена закупки за ед. (сум)')}</div>
                <input type="text" inputMode="decimal" style={inputStyle} value={wBuy}
                  onChange={e => setWBuy(cleanNum(e.target.value))}
                  onBlur={() => normOnBlur(wBuy, setWBuy)} placeholder="0" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>{tt('Цена продажи за ед. (сум)')}</div>
                <input type="text" inputMode="decimal" style={inputStyle} value={wSell}
                  onChange={e => setWSell(cleanNum(e.target.value))}
                  onBlur={() => normOnBlur(wSell, setWSell)} placeholder="0" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>{tt('Количество закупки')}</div>
                <input type="text" inputMode="decimal" style={inputStyle} value={wQty}
                  onChange={e => setWQty(cleanNum(e.target.value))}
                  onBlur={() => normOnBlur(wQty, setWQty)} placeholder="0" />
              </div>
            </div>
            <div className="grid-4">
              <Tile icon="💰" label={tt('Вложим')}          value={fmtMoneyFull(whatIf.invest)}  sub={tt('сум')} color="#1D4ED8" />
              <Tile icon="📈" label={tt('Получим выручки')}  value={fmtMoneyFull(whatIf.revenue)} sub={tt('сум')} color="#0EA5E9" />
              <Tile icon="🟢" label={tt('Прибыль')}          value={fmtMoneyFull(whatIf.profit)}  sub={tt('сум')} color={whatIf.profit >= 0 ? '#16A34A' : '#DC2626'} />
              <Tile icon="💹" label="ROI %" value={whatIf.roi == null ? '—' : `${whatIf.roi >= 0 ? '+' : ''}${Math.round(whatIf.roi)}%`} sub={tt('возврат')} color={roiTier(whatIf.roi).color} />
            </div>
          </Card>

          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)' }}>
            {tt('Формула: ROI = (выручка − закупка) / закупка × 100. Только по одобренным продажам.')}
          </div>
        </>
      )}
    </>
  );
}
