import React, { useState, useEffect, useMemo, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Что если — Закупки»: 3 сценария закупочных решений.
// Бэкенд отдаёт baseline (спрос/оборачиваемость/хранение/маржа/поставщики),
// ВСЯ сценарная математика — на фронте (как в макете).

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// Маленькое поле ввода в строку «лейбл → значение».
function NumRow({ label, value, onChange, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border, #E3EAF3)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 130, textAlign: 'right', padding: '6px 9px',
            border: '1.5px solid var(--border, #E3EAF3)', borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
            background: 'var(--bg, #fff)', color: 'var(--text)',
          }}
        />
        {suffix && <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 28 }}>{suffix}</span>}
      </span>
    </div>
  );
}

// Строка результата «лейбл → число».
function OutRow({ label, value, strong, tone }) {
  const color = tone === 'green' ? 'var(--green, #16A34A)' : tone === 'red' ? 'var(--red, #DC2626)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: strong ? 800 : 500 }}>{label}</span>
      <span className="mono" style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 900 : 700, color }}>{value}</span>
    </div>
  );
}

function Verdict({ ok, yes, no }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 10, fontWeight: 800, fontSize: 13,
      background: ok ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.08)',
      color: ok ? 'var(--green, #16A34A)' : 'var(--red, #DC2626)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{ok ? '✅' : '⛔'}</span>{ok ? yes : no}
    </div>
  );
}

export default function WhatIfPurchasesTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/whatif-base', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const base = data?.baseline || {};
  const suppliers = data?.suppliers || [];

  // ===== Сценарий 1: объёмная скидка =====
  const [s1, setS1] = useState({ curVol: '', tgtVol: '', price: '', disc: 8, storage: '' });
  useEffect(() => {
    if (!data) return;
    setS1({
      curVol: Math.round(base.avg_daily_demand * 30) || 0,
      tgtVol: Math.round(base.avg_daily_demand * 60) || 0,
      price: Math.round(base.avg_buy_price) || 0,
      disc: 8,
      storage: Math.round(base.storage_cost_per_unit_month) || 0,
    });
  }, [data]); // eslint-disable-line

  const r1 = useMemo(() => {
    const curVol = num(s1.curVol), tgtVol = num(s1.tgtVol), price = num(s1.price);
    const disc = num(s1.disc), storage = num(s1.storage);
    const curCost = curVol * price;
    const newCost = tgtVol * price * (1 - disc / 100);
    const priceSave = (tgtVol * price) - newCost;             // экономия на цене за весь объём
    const extraUnits = Math.max(tgtVol - curVol, 0);
    const extraStorage = extraUnits * storage;                 // доп. хранение «лишнего» объёма за месяц
    const net = priceSave - extraStorage;
    return { curCost, newCost, priceSave, extraStorage, net };
  }, [s1]);

  // ===== Сценарий 2: смена поставщика =====
  const [s2, setS2] = useState({ curPrice: '', newPrice: '', curLead: '', newLead: '', ordersYear: '', orderSize: '' });
  useEffect(() => {
    if (!data) return;
    const a = suppliers[0] || {}, b = suppliers[1] || {};
    setS2({
      curPrice: Math.round(a.avg_price || base.avg_buy_price) || 0,
      newPrice: Math.round(b.avg_price || a.avg_price || base.avg_buy_price) || 0,
      curLead: a.lead_time_days || base.lead_time_days || 7,
      newLead: b.lead_time_days || base.lead_time_days || 7,
      ordersYear: 12,
      orderSize: Math.round(base.avg_daily_demand * 30) || 0,
    });
  }, [data]); // eslint-disable-line

  const r2 = useMemo(() => {
    const cp = num(s2.curPrice), np = num(s2.newPrice), cl = num(s2.curLead), nl = num(s2.newLead);
    const orders = num(s2.ordersYear), size = num(s2.orderSize);
    const annualSave = (cp - np) * size * orders;              // экономия на цене за год
    const extraDays = Math.max(nl - cl, 0);
    const safetyUnits = Math.round(extraDays * num(base.avg_daily_demand)); // буфер на удлинение срока
    const safetyCost = safetyUnits * np * (num(base.storage_cost_per_unit_month) ? 1 : 1); // стоимость закупки буфера
    const safetyCapital = safetyUnits * np;                    // замороженный капитал в буфере
    const net = annualSave - safetyCapital;
    return { annualSave, safetyUnits, safetyCost: safetyCapital, net };
  }, [s2, base]);

  // ===== Сценарий 3: отсрочка платежа =====
  const [s3, setS3] = useState({ sum: '', curDefer: '', newDefer: '', surcharge: 2 });
  useEffect(() => {
    if (!data) return;
    setS3({
      sum: Math.round(base.avg_daily_demand * 30 * base.avg_buy_price) || 0,
      curDefer: base.avg_deferral_days || 0,
      newDefer: (base.avg_deferral_days || 0) + 30,
      surcharge: 2,
    });
  }, [data]); // eslint-disable-line

  const r3 = useMemo(() => {
    const sum = num(s3.sum), cur = num(s3.curDefer), nw = num(s3.newDefer), sur = num(s3.surcharge);
    const surchargeCost = sum * sur / 100;                     // наценка поставщика за отсрочку
    const extraDays = Math.max(nw - cur, 0);
    const freeCapital = sum * (Math.min(extraDays, 30) / 30);  // свободный оборотный капитал на 30 дней
    // потенциальная отдача: освобождённый капитал прокрутить с текущей маржой
    const potential = freeCapital * (num(base.margin_pct) / 100);
    const net = potential - surchargeCost;
    return { surchargeCost, freeCapital, potential, net };
  }, [s3, base]);

  return (
    <>
      <PageHeader
        title={tt('🧮 Что если — Закупки')}
        sub={tt('Закупки · моделирование решений · вся математика на лету')}
        actions={<Badge tone="blue">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !data ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📭</div><div>{tt('Нет данных')}</div></div></Card>
      ) : (
        <>
          {/* Baseline-метрики */}
          <div className="o-grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Среднедневной спрос')} value={fmtNum(Math.round(base.avg_daily_demand || 0))} sub={tt('ед./день · 90 дн')} color="var(--primary)" />
            <Tile icon="🔄" label={tt('Оборачиваемость')} value={`${fmtNum(Math.round(base.turnover_days || 0))} ${tt('дн')}`} sub={tt('цикл запаса')} color="#0EA5E9" />
            <Tile icon="🏬" label={tt('Хранение ед./мес')} value={fmtMoneyFull(base.storage_cost_per_unit_month || 0)} sub={tt('UZS')} color="#D97706" />
            <Tile icon="📈" label={tt('Текущая маржа')} value={`${(num(base.margin_pct)).toFixed(1)}%`} sub={tt('по продажам 90 дн')} color="#16A34A" />
          </div>

          {/* Поставщики */}
          <Card icon="🚚" title={`${tt('Поставщики')} (${suppliers.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средняя цена')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Срок поставки')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Отсрочка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Закупок')}</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет поставщиков')}</td></tr>
                  ) : suppliers.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(s.avg_price || 0)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.lead_time_days || 0)} {tt('дн')}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(Math.round(s.avg_deferral_days || 0))} {tt('дн')}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtNum(s.income_count || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ===== Сценарий 1 ===== */}
          <Card icon="🏷️" title={tt('Что если взять объёмную скидку')} style={{ marginBottom: 16 }}>
            <div className="o-grid-2" style={{ gap: 24 }}>
              <div>
                <NumRow label={tt('Текущий объём закупки')} value={s1.curVol} onChange={(v) => setS1({ ...s1, curVol: v })} suffix={tt('ед')} />
                <NumRow label={tt('Целевой объём')} value={s1.tgtVol} onChange={(v) => setS1({ ...s1, tgtVol: v })} suffix={tt('ед')} />
                <NumRow label={tt('Цена за ед. без скидки')} value={s1.price} onChange={(v) => setS1({ ...s1, price: v })} suffix="UZS" />
                <NumRow label={tt('Скидка за объём')} value={s1.disc} onChange={(v) => setS1({ ...s1, disc: v })} suffix="%" />
                <NumRow label={tt('Хранение ед./мес')} value={s1.storage} onChange={(v) => setS1({ ...s1, storage: v })} suffix="UZS" />
              </div>
              <div>
                <OutRow label={tt('Текущая стоимость')} value={fmtMoneyFull(r1.curCost)} />
                <OutRow label={tt('Новая стоимость')} value={fmtMoneyFull(r1.newCost)} />
                <OutRow label={tt('Экономия на цене')} value={fmtMoneyFull(r1.priceSave)} tone="green" />
                <OutRow label={tt('Доп. стоимость хранения')} value={fmtMoneyFull(r1.extraStorage)} tone="red" />
                <OutRow label={tt('Чистая выгода')} value={fmtMoneyFull(r1.net)} strong tone={r1.net >= 0 ? 'green' : 'red'} />
                <Verdict ok={r1.net > 0} yes={tt('Скидку брать выгодно')} no={tt('Скидка не покрывает хранение')} />
              </div>
            </div>
          </Card>

          {/* ===== Сценарий 2 ===== */}
          <Card icon="🔁" title={tt('Что если сменить поставщика')} style={{ marginBottom: 16 }}>
            <div className="o-grid-2" style={{ gap: 24 }}>
              <div>
                <NumRow label={tt('Цена текущего поставщика')} value={s2.curPrice} onChange={(v) => setS2({ ...s2, curPrice: v })} suffix="UZS" />
                <NumRow label={tt('Цена нового поставщика')} value={s2.newPrice} onChange={(v) => setS2({ ...s2, newPrice: v })} suffix="UZS" />
                <NumRow label={tt('Срок поставки текущий')} value={s2.curLead} onChange={(v) => setS2({ ...s2, curLead: v })} suffix={tt('дн')} />
                <NumRow label={tt('Срок поставки новый')} value={s2.newLead} onChange={(v) => setS2({ ...s2, newLead: v })} suffix={tt('дн')} />
                <NumRow label={tt('Заказов в год')} value={s2.ordersYear} onChange={(v) => setS2({ ...s2, ordersYear: v })} suffix={tt('шт')} />
                <NumRow label={tt('Размер заказа')} value={s2.orderSize} onChange={(v) => setS2({ ...s2, orderSize: v })} suffix={tt('ед')} />
              </div>
              <div>
                <OutRow label={tt('Экономия за год')} value={fmtMoneyFull(r2.annualSave)} tone="green" />
                <OutRow label={tt('Доп. страховой запас')} value={`${fmtNum(r2.safetyUnits)} ${tt('ед')}`} />
                <OutRow label={tt('Стоимость страх. запаса')} value={fmtMoneyFull(r2.safetyCost)} tone="red" />
                <OutRow label={tt('Чистая выгода за год')} value={fmtMoneyFull(r2.net)} strong tone={r2.net >= 0 ? 'green' : 'red'} />
                <Verdict ok={r2.net > 0} yes={tt('Стоит менять поставщика')} no={tt('Менять невыгодно')} />
              </div>
            </div>
          </Card>

          {/* ===== Сценарий 3 ===== */}
          <Card icon="⏳" title={tt('Что если использовать отсрочку платежа')} style={{ marginBottom: 16 }}>
            <div className="o-grid-2" style={{ gap: 24 }}>
              <div>
                <NumRow label={tt('Сумма закупки')} value={s3.sum} onChange={(v) => setS3({ ...s3, sum: v })} suffix="UZS" />
                <NumRow label={tt('Текущая отсрочка')} value={s3.curDefer} onChange={(v) => setS3({ ...s3, curDefer: v })} suffix={tt('дн')} />
                <NumRow label={tt('Новая отсрочка')} value={s3.newDefer} onChange={(v) => setS3({ ...s3, newDefer: v })} suffix={tt('дн')} />
                <NumRow label={tt('Наценка за отсрочку')} value={s3.surcharge} onChange={(v) => setS3({ ...s3, surcharge: v })} suffix="%" />
              </div>
              <div>
                <OutRow label={tt('Наценка за отсрочку')} value={fmtMoneyFull(r3.surchargeCost)} tone="red" />
                <OutRow label={tt('Свободный капитал на 30 дн')} value={fmtMoneyFull(r3.freeCapital)} tone="green" />
                <OutRow label={tt('Потенциальная отдача')} value={fmtMoneyFull(r3.potential)} tone="green" />
                <OutRow label={tt('Чистая выгода')} value={fmtMoneyFull(r3.net)} strong tone={r3.net >= 0 ? 'green' : 'red'} />
                <Verdict ok={r3.net > 0} yes={tt('Отсрочка выгодна')} no={tt('Наценка съедает выгоду')} />
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
