import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// EOQ — оптимальный размер заказа (модель Уилсона).
// D — годовой спрос (шт), S — стоимость размещения заказа, H — стоимость хранения единицы в год.
// EOQ = sqrt(2 * D * S / H); заказов в год = D / EOQ; интервал = 365 / (D/EOQ);
// годовые затраты = (D/EOQ)*S + (EOQ/2)*H.
// Числовые поля калькулятора — строковый стейт. В onChange только чистим символы:
// запятая → точка (ru-клавиатура), один разделитель, без минусов. Диапазон и
// нормализация — на onBlur. У type="number" при промежуточном вводе («1500,»)
// браузер отдаёт e.target.value === '' и поле само себя очищает, поэтому здесь
// type="text" + inputMode="decimal".
const cleanDec = (s) => {
  const t = normalizeDecimal(s).replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
};
// Пусто оставляем пустым (eoqCalc трактует как 0), мусор вида «3.» приводим к «3».
const normDec = (s) => {
  if (s === '') return '';
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? String(n) : '';
};

function eoqCalc(D, S, H) {
  D = Math.max(0, parseFloat(D) || 0);
  S = Math.max(0, parseFloat(S) || 0);
  H = Math.max(0, parseFloat(H) || 0);
  if (D <= 0 || H <= 0) return { eoq: 0, ordersPerYear: 0, intervalDays: 0, annualCost: 0 };
  const eoq = Math.sqrt((2 * D * S) / H);
  const ordersPerYear = eoq > 0 ? D / eoq : 0;
  const intervalDays = ordersPerYear > 0 ? 365 / ordersPerYear : 0;
  const annualCost = ordersPerYear * S + (eoq / 2) * H;
  return { eoq, ordersPerYear, intervalDays, annualCost };
}

export default function EoqTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // What-if — локальный калькулятор на клиенте.
  const [wD, setWD] = useState('1000');
  const [wS, setWS] = useState('50000');
  const [wH, setWH] = useState('2000');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/eoq', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const items = data?.items || [];
  const orderCost = data?.order_cost || 50000;

  const totalAnnualCost = useMemo(
    () => items.reduce((s, i) => s + (parseFloat(i.annual_cost) || 0), 0),
    [items]
  );
  const activeCount = useMemo(() => items.filter(i => (parseFloat(i.demand) || 0) > 0).length, [items]);

  const wif = eoqCalc(wD, wS, wH);

  return (
    <>
      <PageHeader
        title={tt('📦 EOQ — оптимальный заказ')}
        sub={tt('Модель Уилсона · спрос за 365 дней · стоимость заказа и хранения')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
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
            <Tile icon="📋" label={tt('Товаров в расчёте')} value={fmtNum(activeCount)} sub={tt('со спросом за год')} color="var(--primary)" />
            <Tile icon="💰" label={tt('Стоимость заказа (S)')} value={fmtMoneyFull(orderCost)} sub={tt('сум · параметр')} color="#1D4ED8" />
            <Tile icon="📊" label={tt('Годовые затраты')} value={fmtMoneyFull(totalAnnualCost)} sub={tt('сум · по оптимуму')} color="#16A34A" />
            <Tile icon="🧮" label={tt('Всего позиций')} value={fmtNum(items.length)} sub={tt('товаров')} color="#0EA5E9" />
          </div>

          <Card icon="📋" title={`${tt('Оптимальный размер заказа по товарам')} (${items.length})`} style={{ marginBottom: 16 }}>
            {items.length === 0 ? (
              <EmptyState
                icon="📦"
                title={tt('Нет данных')}
                description={tt('За последние 365 дней не было одобренных продаж для расчёта EOQ.')}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Годовой спрос')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Оптимальный заказ')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Интервал (дн)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Заказов в год')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Годовые затраты')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 300).map(it => (
                      <tr key={it.product_id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.demand)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                          {fmtNum(Math.round(it.eoq))} {it.unit}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {it.interval_days ? Math.round(it.interval_days) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          {it.orders_per_year ? it.orders_per_year.toFixed(1) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.annual_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🤔" title={tt('Что если — подобрать оптимальный заказ')}>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {tt('Годовой спрос (шт/год)')}
                </label>
                <input type="text" inputMode="decimal" value={wD}
                  onChange={e => setWD(cleanDec(e.target.value))}
                  onBlur={() => setWD(v => normDec(v))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border, #E3EAF3)' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {tt('Стоимость заказа (сум)')}
                </label>
                <input type="text" inputMode="decimal" value={wS}
                  onChange={e => setWS(cleanDec(e.target.value))}
                  onBlur={() => setWS(v => normDec(v))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border, #E3EAF3)' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {tt('Стоимость хранения единицы в год (сум)')}
                </label>
                <input type="text" inputMode="decimal" value={wH}
                  onChange={e => setWH(cleanDec(e.target.value))}
                  onBlur={() => setWH(v => normDec(v))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border, #E3EAF3)' }} />
              </div>
            </div>
            <div className="grid-4">
              <Tile icon="📦" label={tt('Оптимальный заказ')} value={`${fmtNum(Math.round(wif.eoq))} ${tt('шт')}`} color="var(--primary)" />
              <Tile icon="🔁" label={tt('Заказов в год')} value={wif.ordersPerYear ? wif.ordersPerYear.toFixed(1) : '0'} color="#1D4ED8" />
              <Tile icon="📅" label={tt('Дней между заказами')} value={wif.intervalDays ? Math.round(wif.intervalDays) : '—'} color="#0EA5E9" />
              <Tile icon="📊" label={tt('Годовые затраты')} value={`${fmtMoneyFull(wif.annualCost)} ${tt('сум')}`} color="#16A34A" />
            </div>
          </Card>
        </>
      )}
    </>
  );
}
