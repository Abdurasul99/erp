import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Pills, PageHeader, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Что если — Клиенты» — ЧИСТО КЛИЕНТСКИЙ ROI-калькулятор CRM-кампаний.
// Никакого бэкенда/БД: вся математика в useMemo на введённых полях.
// Один раз (best-effort) подтягиваем реальные размеры/средний чек сегментов
// из GET /api/customers/segments (companyId-скоуп), чтобы префилл-дефолты были
// «как в компании». Если запрос не удался — остаются редактируемые числовые дефолты.
//
// Универсальная константа валовой маржи = 0.56 (56%) — общая для всех сценариев.
const WIF_MARGIN = 0.56;
const WIF_AD_CAC = 50000; // бенчмарк стоимости привлечения через рекламу

// Префилл-дефолты сегментов (если segments API недоступен).
// Ключи совпадают с RFM-сегментами бэка: hibernating (спящие), loyal (лояльные),
// new (новые/новички), at_risk (в зоне риска).
const WIF_SEG_DEFAULTS = {
  hibernating: { size: 312, check: 45000, label: 'Спящие' },
  loyal:       { size: 156, check: 85000, label: 'Лояльные' },
  new:         { size: 89,  check: 32000, label: 'Новые' },
  at_risk:     { size: 54,  check: 150000, label: 'В зоне риска' },
};

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Поле числового ввода в едином стиле
function NumField({ label, value, onChange, suffix, min = 0, step = 1, placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number" inputMode="decimal" min={min} step={step}
          value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="input"
          style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </span>
    </label>
  );
}

// Карточка вердикта Go / No-Go
function Verdict({ ok, okText, noText, hint }) {
  const { tt } = useTt();
  return (
    <div style={{
      marginTop: 16, padding: '14px 16px', borderRadius: 12,
      background: ok ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)',
      border: '1px solid ' + (ok ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'),
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 30, lineHeight: 1 }}>{ok ? '✅' : '❌'}</span>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16, color: ok ? '#16A34A' : '#DC2626' }}>
          {ok ? tt(okText) : tt(noText)}
        </div>
        {hint && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>{tt(hint)}</div>}
      </div>
    </div>
  );
}

export default function WhatIfClientsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [tab, setTab] = useState('sms');
  const [segData, setSegData] = useState(WIF_SEG_DEFAULTS);

  // best-effort подтягивание реальных сегментов (companyId-скоуп на бэке).
  // Эндпоинт /customers/segments фильтрует по company_id и НЕ по филиалу,
  // поэтому branch_id не передаём (он бы всё равно игнорировался).
  useEffect(() => {
    let ignore = false;
    api.get('/customers/segments')
      .then(r => {
        if (ignore) return;
        const segs = r.data?.segments || [];
        const next = { ...WIF_SEG_DEFAULTS };
        for (const s of segs) {
          if (next[s.key] && s.count > 0) {
            next[s.key] = { ...next[s.key], size: s.count, check: s.avg_ltv > 0 ? s.avg_ltv : next[s.key].check };
          }
        }
        setSegData(next);
      })
      .catch(() => { /* остаются дефолты — это нормально */ });
    return () => { ignore = true; };
  }, []);

  return (
    <>
      <PageHeader title={tt('🎰 Что если — Клиенты')} sub={tt('ROI CRM-кампаний: SMS-рассылка · реферальная программа · поздравления с ДР')} />

      <div style={{ marginBottom: 16 }}>
        <Pills
          value={tab}
          onChange={setTab}
          label={tt('Сценарий кампании')}
          options={[
            { value: 'sms', label: tt('📲 SMS-рассылка') },
            { value: 'ref', label: tt('🤝 Рефералы') },
            { value: 'bday', label: tt('🎂 Поздравления с ДР') },
          ]}
        />
      </div>

      {tab === 'sms' && <SmsScenario segData={segData} />}
      {tab === 'ref' && <ReferralScenario segData={segData} />}
      {tab === 'bday' && <BirthdayScenario segData={segData} />}

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
        ℹ️ {tt('Это калькулятор «что если» — все цифры считаются на лету по введённым параметрам, ничего не сохраняется.')}{' '}
        {tt('Валовая маржа принята')} <strong>{Math.round(WIF_MARGIN * 100)}%</strong>.{' '}
        {tt('Размеры сегментов и средний чек подтянуты из вашей RFM-сегментации (можно править вручную).')}
      </div>
    </>
  );
}

// ───────────────────────── Сценарий 1: SMS-рассылка ─────────────────────────
function SmsScenario({ segData }) {
  const { tt } = useTt();
  const segKeys = Object.keys(segData);
  const [segKey, setSegKey] = useState('hibernating');
  const seg = segData[segKey] || segData[segKeys[0]];

  const [size, setSize] = useState(String(seg.size));
  const [check, setCheck] = useState(String(seg.check));
  const [discount, setDiscount] = useState(20);
  const [respRate, setRespRate] = useState(15);
  const [smsPrice, setSmsPrice] = useState('');

  // префилл размера/чека: реагируем и на смену сегмента, и на асинхронную
  // загрузку segData (иначе при позднем ответе API поля остались бы старыми)
  useEffect(() => {
    setSize(String(seg.size));
    setCheck(String(seg.check));
  }, [segKey, seg.size, seg.check]);

  const c = useMemo(() => {
    const segSize = num(size), avgCheck = num(check);
    const disc = num(discount), rate = num(respRate), price = num(smsPrice);
    const smsCost = segSize * price;
    const responders = Math.round(segSize * rate / 100);
    const revenue = responders * avgCheck * (1 - disc / 100);
    const grossProfit = revenue * WIF_MARGIN;
    const netProfit = grossProfit - smsCost;
    return { segSize, responders, smsCost, revenue, grossProfit, netProfit, ok: netProfit > 0 };
  }, [size, check, discount, respRate, smsPrice]);

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card icon="📲" title={tt('Параметры SMS-рассылки')}>
        <div style={{ padding: '6px 2px' }}>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>{tt('Сегмент клиентов')}</span>
            <select className="input" value={segKey} onChange={e => setSegKey(e.target.value)} style={{ width: '100%', fontWeight: 700 }}>
              {segKeys.map(k => (
                <option key={k} value={k}>{tt(segData[k].label)} · {fmtNum(segData[k].size)} {tt('чел')}</option>
              ))}
            </select>
          </label>
          <NumField label={tt('Размер сегмента')} value={size} onChange={setSize} suffix={tt('чел')} />
          <NumField label={tt('Средний чек')} value={check} onChange={setCheck} suffix={tt('сум')} step={1000} />
          <NumField label={tt('Размер скидки')} value={discount} onChange={setDiscount} suffix="%" />
          <NumField label={tt('Ожидаемый отклик')} value={respRate} onChange={setRespRate} suffix="%" />
          <NumField label={tt('Цена 1 SMS')} value={smsPrice} onChange={setSmsPrice} suffix={tt('сум')} step={10} placeholder={tt('напр. 80')} />
        </div>
      </Card>

      <Card icon="📊" title={tt('Результат')}>
        <div className="grid-2" style={{ marginBottom: 4 }}>
          <Tile icon="👥" label={tt('Откликнутся')} value={fmtNum(c.responders)} sub={tt('клиентов')} color="#0EA5E9" />
          <Tile icon="💸" label={tt('Затраты на SMS')} value={fmtMoneyFull(c.smsCost)} sub={tt('сум')} color="#DC2626" />
          <Tile icon="💰" label={tt('Выручка')} value={fmtMoneyFull(c.revenue)} sub={tt('сум (со скидкой)')} color="#1D4ED8" />
          <Tile icon="💎" label={tt('Валовая прибыль')} value={fmtMoneyFull(c.grossProfit)} sub={`${Math.round(WIF_MARGIN * 100)}% ${tt('маржа')}`} color="#16A34A" />
        </div>
        <Tile icon="🏦" label={tt('Чистая прибыль кампании')} value={fmtMoneyFull(c.netProfit)} sub={tt('выручка×маржа − затраты на SMS')} color={c.netProfit >= 0 ? '#16A34A' : '#DC2626'} />
        <Verdict ok={c.ok}
          okText="Запускать — кампания в плюс"
          noText="Не запускать — кампания в минус"
          hint={c.ok
            ? 'Чистая прибыль положительная: SMS окупаются.'
            : 'Затраты на SMS превышают валовую прибыль от откликов.'} />
      </Card>
    </div>
  );
}

// ───────────────────────── Сценарий 2: Реферальная программа ─────────────────────────
function ReferralScenario({ segData }) {
  const { tt } = useTt();
  const loyal = segData.loyal || { size: 156, check: 85000 };

  const [base, setBase] = useState(String(loyal.size));
  const [inviteRate, setInviteRate] = useState(20);
  const [avgFriends, setAvgFriends] = useState(3);
  const [convRate, setConvRate] = useState(40);
  const [bonus, setBonus] = useState('');
  const [avgCheck, setAvgCheck] = useState(String(loyal.check));

  useEffect(() => {
    setBase(String(loyal.size));
    setAvgCheck(String(loyal.check));
  }, [loyal.size, loyal.check]);

  const c = useMemo(() => {
    const baseN = num(base), iRate = num(inviteRate), friends = num(avgFriends);
    const conv = num(convRate), bonusN = num(bonus), check = num(avgCheck);
    const inviters = Math.round(baseN * iRate / 100);
    const totalFriends = inviters * friends;
    const newCustomers = Math.round(totalFriends * conv / 100);
    const revenue = newCustomers * check;
    const bonusCost = newCustomers * bonusN;
    const grossProfit = revenue * WIF_MARGIN;
    const netProfit = grossProfit - bonusCost;
    const referralCAC = newCustomers > 0 ? bonusCost / newCustomers : 0;
    return { inviters, totalFriends, newCustomers, revenue, bonusCost, grossProfit, netProfit, referralCAC, ok: newCustomers > 0 && referralCAC < WIF_AD_CAC };
  }, [base, inviteRate, avgFriends, convRate, bonus, avgCheck]);

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card icon="🤝" title={tt('Параметры реферальной программы')}>
        <div style={{ padding: '6px 2px' }}>
          <NumField label={tt('Лояльных клиентов в базе')} value={base} onChange={setBase} suffix={tt('чел')} />
          <NumField label={tt('Доля, кто пригласит')} value={inviteRate} onChange={setInviteRate} suffix="%" />
          <NumField label={tt('Сколько друзей зовёт каждый')} value={avgFriends} onChange={setAvgFriends} suffix={tt('чел')} step={0.5} />
          <NumField label={tt('Конверсия друзей в покупку')} value={convRate} onChange={setConvRate} suffix="%" />
          <NumField label={tt('Бонус за приведённого друга')} value={bonus} onChange={setBonus} suffix={tt('сум')} step={1000} placeholder={tt('напр. 20000')} />
          <NumField label={tt('Средний чек первой покупки')} value={avgCheck} onChange={setAvgCheck} suffix={tt('сум')} step={1000} />
        </div>
      </Card>

      <Card icon="📊" title={tt('Результат')}>
        <div className="grid-2" style={{ marginBottom: 4 }}>
          <Tile icon="📣" label={tt('Пригласят')} value={fmtNum(c.inviters)} sub={tt('клиентов')} color="#EC4899" />
          <Tile icon="🆕" label={tt('Новых клиентов')} value={fmtNum(c.newCustomers)} sub={tt('придут по реф.')} color="#0EA5E9" />
          <Tile icon="💰" label={tt('Выручка')} value={fmtMoneyFull(c.revenue)} sub={tt('сум')} color="#1D4ED8" />
          <Tile icon="🎁" label={tt('Затраты на бонусы')} value={fmtMoneyFull(c.bonusCost)} sub={tt('сум')} color="#DC2626" />
        </div>
        <div className="grid-2">
          <Tile icon="🏦" label={tt('Чистая прибыль')} value={fmtMoneyFull(c.netProfit)} sub={tt('выручка×маржа − бонусы')} color={c.netProfit >= 0 ? '#16A34A' : '#DC2626'} />
          <Tile icon="🎯" label={tt('CAC реферала')} value={fmtMoneyFull(c.referralCAC)}
            sub={`${tt('реклама')} ≈ ${fmtMoneyFull(WIF_AD_CAC)}`} color={c.ok ? '#16A34A' : '#D97706'} />
        </div>
        <Verdict ok={c.ok}
          okText="Запускать — рефералы дешевле рекламы"
          noText="Не запускать — реферал дороже рекламы"
          hint={c.ok
            ? `CAC реферала ниже бенчмарка рекламы (${fmtMoneyFull(WIF_AD_CAC)} сум).`
            : `CAC реферала выше или равен рекламному бенчмарку (${fmtMoneyFull(WIF_AD_CAC)} сум).`} />
      </Card>
    </div>
  );
}

// ───────────────────────── Сценарий 3: Поздравления с ДР ─────────────────────────
function BirthdayScenario({ segData }) {
  const { tt } = useTt();
  const loyal = segData.loyal || { size: 156, check: 85000 };

  const [base, setBase] = useState(String(loyal.size));
  const [discount, setDiscount] = useState(20);
  const [usageRate, setUsageRate] = useState(50);
  const [avgCheck, setAvgCheck] = useState(String(loyal.check));

  useEffect(() => {
    setBase(String(loyal.size));
    setAvgCheck(String(loyal.check));
  }, [loyal.size, loyal.check]);

  const c = useMemo(() => {
    const baseN = num(base), disc = num(discount), usage = num(usageRate), check = num(avgCheck);
    const usersPerYear = Math.round(baseN * usage / 100);
    const revenuePerYear = usersPerYear * check;
    const discountCost = revenuePerYear * disc / 100;
    const incrementalRevenue = revenuePerYear * 0.5; // 50% и так бы купили
    const incrementalProfit = incrementalRevenue * WIF_MARGIN - discountCost * 0.5;
    return { usersPerYear, revenuePerYear, discountCost, incrementalRevenue, incrementalProfit, ok: incrementalProfit > 0 };
  }, [base, discount, usageRate, avgCheck]);

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card icon="🎂" title={tt('Параметры программы «День рождения»')}>
        <div style={{ padding: '6px 2px' }}>
          <NumField label={tt('Клиентов с известной датой рождения')} value={base} onChange={setBase} suffix={tt('чел')} />
          <NumField label={tt('Скидка ко дню рождения')} value={discount} onChange={setDiscount} suffix="%" />
          <NumField label={tt('Доля, кто воспользуется скидкой')} value={usageRate} onChange={setUsageRate} suffix="%" />
          <NumField label={tt('Средний чек именинника')} value={avgCheck} onChange={setAvgCheck} suffix={tt('сум')} step={1000} />
        </div>
      </Card>

      <Card icon="📊" title={tt('Результат (в год)')}>
        <div className="grid-2" style={{ marginBottom: 4 }}>
          <Tile icon="🎉" label={tt('Воспользуются / год')} value={fmtNum(c.usersPerYear)} sub={tt('клиентов')} color="#EC4899" />
          <Tile icon="💰" label={tt('Выручка / год')} value={fmtMoneyFull(c.revenuePerYear)} sub={tt('сум')} color="#1D4ED8" />
          <Tile icon="🏷️" label={tt('Стоимость скидок')} value={fmtMoneyFull(c.discountCost)} sub={tt('сум')} color="#DC2626" />
          <Tile icon="📈" label={tt('Доп. выручка')} value={fmtMoneyFull(c.incrementalRevenue)} sub={tt('сверх обычной (50%)')} color="#0EA5E9" />
        </div>
        <Tile icon="🏦" label={tt('Дополнительная прибыль / год')} value={fmtMoneyFull(c.incrementalProfit)}
          sub={tt('доп.выручка×маржа − половина скидок')} color={c.incrementalProfit >= 0 ? '#16A34A' : '#DC2626'} />
        <Verdict ok={c.ok}
          okText="Запускать — программа приносит доп. прибыль"
          noText="Не запускать — скидки съедают прибыль"
          hint={c.ok
            ? 'Дополнительная прибыль от программы положительная.'
            : 'Стоимость скидок превышает прирост прибыли.'} />
      </Card>
    </div>
  );
}