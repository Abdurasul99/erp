import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Что если — Склад»: read-only baseline c сервера, вся математика сценариев на фронте.
// 4 сценария: объём закупки · цена поставщика · распродажа неликвида · сравнение поставщиков.

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const pct = (v) => `${(num(v)).toFixed(1)}%`;

function NumField({ label, value, onChange, suffix, min = 0, step = 1 }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number" value={value} min={min} step={step}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border, #E3EAF3)', fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
          }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
    </label>
  );
}

function ResultRow({ label, value, tone }) {
  const color = tone === 'good' ? 'var(--green, #16A34A)' : tone === 'bad' ? 'var(--red, #DC2626)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid var(--border, #EEF2F7)' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      <span className="mono" style={{ fontWeight: 800, fontSize: 14, color }}>{value}</span>
    </div>
  );
}

function ProductPicker({ label, products, value, onChange, tt }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #E3EAF3)', fontWeight: 700, fontSize: 13 }}
      >
        {products.length === 0 && <option value="">{tt('Нет товаров')}</option>}
        {products.map(p => <option key={p.product_id} value={String(p.product_id)}>{p.name}</option>)}
      </select>
    </label>
  );
}

export default function InventoryWhatifTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- inputs per scenario ---
  const [pid1, setPid1] = useState('');      // S1 product
  const [qty1, setQty1] = useState('110');   // S1 purchase qty
  const [pid2, setPid2] = useState('');      // S2 product
  const [newBuy2, setNewBuy2] = useState(''); // S2 new supplier buy price
  const [disc3, setDisc3] = useState('30');  // S3 discount %
  const [sellable3, setSellable3] = useState('70'); // S3 sellable %
  const [did3, setDid3] = useState('');      // S3 dead-stock id
  const [pid4, setPid4] = useState('');      // S4 product
  const [newBuy4, setNewBuy4] = useState('');// S4 new supplier price
  const [newLead4, setNewLead4] = useState('');// S4 new lead time
  const [orders4, setOrders4] = useState('12'); // S4 orders / year

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/whatif-base', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const products = data?.products || [];
  const dead = data?.dead_stock || [];

  // default selections once data arrives
  useEffect(() => {
    if (products.length) {
      if (!pid1) setPid1(String(products[0].product_id));
      if (!pid2) { setPid2(String(products[0].product_id)); }
      if (!pid4) { setPid4(String(products[0].product_id)); }
    }
    if (dead.length && !did3) setDid3(String(dead[0].product_id));
  }, [products, dead]); // eslint-disable-line

  const byId = useMemo(() => Object.fromEntries(products.map(p => [String(p.product_id), p])), [products]);
  const deadById = useMemo(() => Object.fromEntries(dead.map(d => [String(d.product_id), d])), [dead]);

  // === Scenario 1: purchase volume ===
  const s1 = useMemo(() => {
    const p = byId[pid1]; if (!p) return null;
    const q = num(qty1);
    const buy = num(p.price_buy), sell = num(p.price_sell);
    const monthly = num(p.monthly_sales);
    const lead = num(p.lead_time_days, 7);
    const investment = q * buy;
    const revenue = q * sell;
    const profit = q * (sell - buy);
    const roi = investment > 0 ? (profit / investment) * 100 : 0;
    const totalStock = num(p.stock) + q;
    const daysCover = monthly > 0 ? (totalStock / (monthly / 30)) : null;
    const reorderInDays = daysCover != null ? Math.max(0, daysCover - lead) : null;
    return { p, q, investment, revenue, profit, roi, daysCover, reorderInDays, lead };
  }, [byId, pid1, qty1]);

  // === Scenario 2: supplier price change ===
  const s2 = useMemo(() => {
    const p = byId[pid2]; if (!p) return null;
    const buyOld = num(p.price_buy), sell = num(p.price_sell);
    const buyNew = newBuy2 === '' ? buyOld : num(newBuy2);
    const monthly = num(p.monthly_sales);
    const marginOld = sell > 0 ? ((sell - buyOld) / sell) * 100 : 0;
    const marginNew = sell > 0 ? ((sell - buyNew) / sell) * 100 : 0;
    const profitDeltaUnit = (sell - buyNew) - (sell - buyOld); // = buyOld - buyNew
    const monthlyDelta = profitDeltaUnit * monthly;
    const yearlyDelta = monthlyDelta * 12;
    return { p, buyOld, buyNew, sell, marginOld, marginNew, monthlyDelta, yearlyDelta, monthly };
  }, [byId, pid2, newBuy2]);

  // === Scenario 3: dead-stock liquidation ===
  const s3 = useMemo(() => {
    const d = deadById[did3]; if (!d) return null;
    const qty = num(d.quantity), cost = num(d.cost_per_unit);
    const sell = num(d.price_sell);
    const discount = num(disc3), sellableP = num(sellable3);
    const unitsSold = Math.round(qty * (sellableP / 100));
    const liqPrice = sell * (1 - discount / 100);
    const revenue = unitsSold * liqPrice;
    const costOfSold = unitsSold * cost;
    const result = revenue - costOfSold; // прибыль/убыток от распродажи
    const frozenLeft = (qty - unitsSold) * cost;
    return { d, qty, unitsSold, liqPrice, revenue, result, frozenLeft, discount };
  }, [deadById, did3, disc3, sellable3]);

  // === Scenario 4: supplier comparison ===
  const s4 = useMemo(() => {
    const p = byId[pid4]; if (!p) return null;
    const buyOld = num(p.price_buy);
    const buyNew = newBuy4 === '' ? buyOld : num(newBuy4);
    const leadOld = num(p.lead_time_days, 7);
    const leadNew = newLead4 === '' ? leadOld : num(newLead4);
    const monthly = num(p.monthly_sales);
    const orders = num(orders4, 12);
    const annualQty = monthly * 12;
    const annualSaving = (buyOld - buyNew) * annualQty;
    // доп. страховой запас при росте срока поставки
    const daily = monthly / 30;
    const extraSafetyUnits = Math.max(0, Math.round((leadNew - leadOld) * daily));
    const safetyCost = extraSafetyUnits * buyNew;
    const netBenefit = annualSaving - safetyCost;
    return { p, buyOld, buyNew, leadOld, leadNew, annualSaving, extraSafetyUnits, safetyCost, netBenefit, orders };
  }, [byId, pid4, newBuy4, newLead4, orders4]);

  // baseline KPIs
  const kpis = useMemo(() => {
    const totalStockVal = products.reduce((s, p) => s + num(p.stock) * num(p.price_buy), 0);
    const deadVal = dead.reduce((s, d) => s + num(d.quantity) * num(d.cost_per_unit), 0);
    return { totalStockVal, deadVal, productCount: products.length, deadCount: dead.length };
  }, [products, dead]);

  if (loading) {
    return (
      <>
        <PageHeader title={tt('🔮 Что если — Склад')} sub={tt('Финансовые последствия складских решений до их принятия')} />
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={60} /></Card>)}
        </div>
        <Card><Skeleton height={180} /></Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={tt('🔮 Что если — Склад')} />
        <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>
      </>
    );
  }

  if (!products.length) {
    return (
      <>
        <PageHeader title={tt('🔮 Что если — Склад')} />
        <Card>
          <EmptyState icon="📦" title={tt('Нет товаров')} description={tt('Добавьте товары и приёмки, чтобы моделировать сценарии')} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={tt('🔮 Что если — Склад')}
        sub={tt('Финансовые последствия складских решений до их принятия')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Tile icon="📦" label={tt('Товаров')} value={fmtNum(kpis.productCount)} sub={tt('в каталоге филиала')} color="var(--primary)" />
        <Tile icon="💰" label={tt('Стоимость склада')} value={fmtMoneyFull(kpis.totalStockVal)} sub={tt('по себестоимости, UZS')} color="#16A34A" />
        <Tile icon="🧊" label={tt('Неликвид')} value={fmtNum(kpis.deadCount)} sub={tt('позиций без движения')} color="#DC2626" />
        <Tile icon="❄️" label={tt('Замороженный капитал')} value={fmtMoneyFull(kpis.deadVal)} sub={tt('в неликвиде, UZS')} color="#DC2626" />
      </div>

      {/* ===== Scenario 1: purchase volume ===== */}
      <Card icon="📥" title={tt('Сценарий 1 · Объём закупки')} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <ProductPicker label={tt('Товар')} products={products} value={pid1} onChange={setPid1} tt={tt} />
            <NumField label={tt('Количество закупки')} value={qty1} onChange={setQty1} suffix={s1?.p?.unit} />
            {s1 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                {tt('Закуп')}: {fmtMoneyFull(s1.p.price_buy)} · {tt('Продажа')}: {fmtMoneyFull(s1.p.price_sell)} UZS · {tt('Продаж/мес')}: {fmtNum(s1.p.monthly_sales)}
              </div>
            )}
          </div>
          {s1 && (
            <div>
              <ResultRow label={tt('Инвестиция')} value={`${fmtMoneyFull(s1.investment)} UZS`} />
              <ResultRow label={tt('Ожидаемая выручка')} value={`${fmtMoneyFull(s1.revenue)} UZS`} />
              <ResultRow label={tt('Прибыль')} value={`${fmtMoneyFull(s1.profit)} UZS`} tone={s1.profit >= 0 ? 'good' : 'bad'} />
              <ResultRow label={tt('ROI')} value={pct(s1.roi)} tone={s1.roi >= 0 ? 'good' : 'bad'} />
              <ResultRow label={tt('Запаса хватит на')} value={s1.daysCover == null ? '—' : `${fmtNum(Math.round(s1.daysCover))} ${tt('дн')}`} />
              <ResultRow label={tt('Дозаказ через')} value={s1.reorderInDays == null ? '—' : `${fmtNum(Math.round(s1.reorderInDays))} ${tt('дн')}`} />
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                {s1.roi >= 0
                  ? `${tt('Вывод: закупка окупается, ROI')} ${pct(s1.roi)}.`
                  : tt('Вывод: закупка убыточна при текущих ценах.')}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ===== Scenario 2: supplier price ===== */}
      <Card icon="🏷️" title={tt('Сценарий 2 · Цена поставщика')} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <ProductPicker label={tt('Товар')} products={products} value={pid2} onChange={setPid2} tt={tt} />
            {s2 && <NumField label={tt('Текущая цена закупки')} value={s2.buyOld} onChange={() => {}} suffix="UZS" />}
            <NumField label={tt('Новая цена закупки')} value={newBuy2} onChange={setNewBuy2} suffix="UZS" />
            {s2 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                {tt('Цена продажи')}: {fmtMoneyFull(s2.sell)} UZS · {tt('Продаж/мес')}: {fmtNum(s2.monthly)}
              </div>
            )}
          </div>
          {s2 && (
            <div>
              <ResultRow label={tt('Текущая маржа')} value={pct(s2.marginOld)} />
              <ResultRow label={tt('Новая маржа')} value={pct(s2.marginNew)} tone={s2.marginNew >= s2.marginOld ? 'good' : 'bad'} />
              <ResultRow label={tt('Прибыль/мес (изменение)')} value={`${s2.monthlyDelta >= 0 ? '+' : ''}${fmtMoneyFull(s2.monthlyDelta)} UZS`} tone={s2.monthlyDelta >= 0 ? 'good' : 'bad'} />
              <ResultRow label={tt('Прибыль/год (изменение)')} value={`${s2.yearlyDelta >= 0 ? '+' : ''}${fmtMoneyFull(s2.yearlyDelta)} UZS`} tone={s2.yearlyDelta >= 0 ? 'good' : 'bad'} />
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                {s2.monthlyDelta > 0
                  ? tt('Рекомендация: новая цена выгоднее — переходить.')
                  : s2.monthlyDelta < 0
                    ? tt('Рекомендация: новая цена дороже — остаться у текущего поставщика.')
                    : tt('Рекомендация: цена не меняет прибыль.')}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ===== Scenario 3: dead-stock liquidation ===== */}
      <Card icon="🧊" title={tt('Сценарий 3 · Распродажа неликвида')} style={{ marginBottom: 16 }}>
        {dead.length === 0 ? (
          <EmptyState icon="✅" title={tt('Неликвида нет')} description={tt('Все товары двигаются — замороженного капитала нет')} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 4 }}>{tt('Неликвидный товар')}</div>
                <select value={did3} onChange={(e) => setDid3(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #E3EAF3)', fontWeight: 700, fontSize: 13 }}>
                  {dead.map(d => <option key={d.product_id} value={String(d.product_id)}>{d.name} · {fmtNum(d.quantity)} {d.unit} · {fmtNum(d.idle_days)} {tt('дн')}</option>)}
                </select>
              </label>
              <NumField label={tt('Скидка')} value={disc3} onChange={setDisc3} suffix="%" max={100} />
              <NumField label={tt('Доля распродаваемого остатка')} value={sellable3} onChange={setSellable3} suffix="%" max={100} />
              {s3 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  {tt('Себестоимость')}: {fmtMoneyFull(s3.d.cost_per_unit)} · {tt('Цена')}: {fmtMoneyFull(s3.d.price_sell)} UZS · {tt('Без движения')}: {fmtNum(s3.d.idle_days)} {tt('дн')}
                </div>
              )}
            </div>
            {s3 && (
              <div>
                <ResultRow label={tt('Продано единиц')} value={`${fmtNum(s3.unitsSold)} ${s3.d.unit}`} />
                <ResultRow label={tt('Цена распродажи')} value={`${fmtMoneyFull(s3.liqPrice)} UZS`} />
                <ResultRow label={tt('Выручка от распродажи')} value={`${fmtMoneyFull(s3.revenue)} UZS`} />
                <ResultRow label={s3.result >= 0 ? tt('Прибыль распродажи') : tt('Убыток распродажи')} value={`${fmtMoneyFull(s3.result)} UZS`} tone={s3.result >= 0 ? 'good' : 'bad'} />
                <ResultRow label={tt('Останется заморожено')} value={`${fmtMoneyFull(s3.frozenLeft)} UZS`} tone={s3.frozenLeft > 0 ? 'bad' : 'good'} />
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {s3.result >= 0
                    ? `${tt('Вывод: распродажа высвобождает капитал и даёт прибыль')} ${fmtMoneyFull(s3.result)} UZS.`
                    : `${tt('Вывод: распродажа даёт убыток')} ${fmtMoneyFull(Math.abs(s3.result))} UZS, но высвобождает оборотные средства.`}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ===== Scenario 4: supplier comparison ===== */}
      <Card icon="⚖️" title={tt('Сценарий 4 · Сравнение поставщиков')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <ProductPicker label={tt('Товар')} products={products} value={pid4} onChange={setPid4} tt={tt} />
            {s4 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <NumField label={tt('Текущая цена')} value={s4.buyOld} onChange={() => {}} suffix="UZS" />
                <NumField label={tt('Новая цена')} value={newBuy4} onChange={setNewBuy4} suffix="UZS" />
                <NumField label={tt('Текущий срок поставки')} value={s4.leadOld} onChange={() => {}} suffix={tt('дн')} />
                <NumField label={tt('Новый срок поставки')} value={newLead4} onChange={setNewLead4} suffix={tt('дн')} />
              </div>
            )}
            <NumField label={tt('Заказов в год')} value={orders4} onChange={setOrders4} suffix={tt('раз')} />
          </div>
          {s4 && (
            <div>
              <ResultRow label={tt('Экономия на закупке/год')} value={`${s4.annualSaving >= 0 ? '+' : ''}${fmtMoneyFull(s4.annualSaving)} UZS`} tone={s4.annualSaving >= 0 ? 'good' : 'bad'} />
              <ResultRow label={tt('Доп. страховой запас')} value={`${fmtNum(s4.extraSafetyUnits)} ${s4.p.unit}`} />
              <ResultRow label={tt('Стоимость страх. запаса')} value={`${fmtMoneyFull(s4.safetyCost)} UZS`} />
              <ResultRow label={tt('Чистая выгода/год')} value={`${s4.netBenefit >= 0 ? '+' : ''}${fmtMoneyFull(s4.netBenefit)} UZS`} tone={s4.netBenefit >= 0 ? 'good' : 'bad'} />
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                {s4.netBenefit > 0
                  ? `${tt('Рекомендация: сменить поставщика, чистая выгода')} ${fmtMoneyFull(s4.netBenefit)} UZS/${tt('год')}.`
                  : tt('Рекомендация: смена невыгодна — рост срока поставки съедает экономию.')}
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
