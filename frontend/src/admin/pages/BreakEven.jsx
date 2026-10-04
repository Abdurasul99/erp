import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api.js';
import { PageHeader, Skeleton, Pills } from '../../owner/ui.jsx';
import { normalizeDecimal } from '../../utils/decimalInput.js';
import { calcBreakEven, linkForecastFields, sumItems, toNumber, reasonText } from '../../utils/breakEven.js';
import BreakEvenChart from './BreakEvenChart.jsx';

// Экран точки безубыточности САМОЙ платформы WoW — раскладка один в один с
// макетом: слева ввод, справа результат и график.
// «Клиент» здесь = платящий филиал компании-клиента, «средний чек» = абонплата.
// Все формулы живут в utils/breakEven.js — здесь их копий нет и быть не должно.

const SYMBOL = { UZS: 'сум', USD: '$', RUB: '₽' };
const CUR_OPTS = [
  { value: 'UZS', label: 'сум' },
  { value: 'USD', label: '$' },
  { value: 'RUB', label: '₽' },
];

// Суммы вводятся текстом, а не type="number": Chrome на промежуточно-невалидном
// вводе («20 300 000», «1500,») отдаёт e.target.value === '', и контролируемое поле
// само себя очищает — пользователь не может стереть первую цифру.
const clean = (s) => String(s ?? '').replace(/[^\d.,\s-]/g, '');
const parse = (s) => parseFloat(normalizeDecimal(s));
const toMoney = (s) => { const n = parse(s); return Number.isFinite(n) && n > 0 ? n : 0; };
const toMoneyOrNull = (s) => {
  const raw = String(s ?? '').trim();
  if (raw === '') return null;
  const n = parse(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const norm = (s) => {
  const raw = String(s ?? '').replace(/\s/g, '').trim();
  if (raw === '') return '';
  const n = parse(raw);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
};
const numStr = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
const trim2 = (v) => Math.round(v * 100) / 100;

const fmtRu = (v, digits) => v.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const makeMoney = (cur) => (v) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const s = fmtRu(v, abs > 0 && abs < 100 ? 2 : 0);
  return cur === 'USD' ? `$${s}` : `${s} ${SYMBOL[cur] || ''}`.trim();
};
// Крупные суммы в главной плитке — коротко, как в макете: «178.7 млн».
const short = (v, cur) => {
  if (v === null || !Number.isFinite(v)) return '—';
  const s = SYMBOL[cur] || '';
  if (Math.abs(v) >= 1e9) return `${fmtRu(trim2(v / 1e9), 1)} млрд`;
  if (Math.abs(v) >= 1e6) return `${fmtRu(trim2(v / 1e6), 1)} млн`;
  return cur === 'USD' ? `$${fmtRu(Math.round(v), 0)}` : `${fmtRu(Math.round(v), 0)} ${s}`.trim();
};
const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtRu(trim2(v), Math.abs(v) < 10 ? 1 : 0)}%`);
const qty = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : fmtRu(v, 0));

// Строки списка статей живут с локальным id: без него удаление средней строки
// заставляет React переиспользовать поля по индексу и фокус прыгает.
let seq = 0;
const uid = () => 'it' + (++seq);
const withIds = (arr) => (Array.isArray(arr) ? arr : []).map(it => ({ id: uid(), name: it?.name || '', amount: numStr(it?.amount ?? '') }));
const packItems = (arr) => arr
  .map(it => ({ name: String(it.name || '').trim().slice(0, 80), amount: toMoney(it.amount) }))
  .filter(it => it.name !== '' || it.amount > 0);

// Последние 6 ПОЛНЫХ месяцев. Правило из макета: смешивать неполную выручку с
// полными постоянными нельзя — поэтому текущий месяц в список не попадает.
function fullMonths(count = 6) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    d.setMonth(d.getMonth() - 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    out.push({ key, label: label[0].toUpperCase() + label.slice(1) + (i === 0 ? ' · последний полный' : '') });
  }
  return out;
}

const fieldBox = {
  width: '100%', minWidth: 0, padding: '11px 12px', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 15, fontFamily: 'inherit', fontWeight: 700,
  textAlign: 'right', outline: 'none', background: 'var(--surface)', color: 'var(--text)',
};
const hintStyle = { fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 };

function NumField({ label, unit, value, onChange, onBlur, hint, placeholder }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label className="label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input style={{ ...fieldBox, paddingRight: unit ? 46 : 12 }} type="text" inputMode="decimal" value={value}
          placeholder={placeholder}
          onChange={e => onChange(clean(e.target.value))}
          onBlur={onBlur ? () => onBlur() : undefined} />
        {unit && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{unit}</span>
        )}
      </div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

// Строка-плашка «подпись … значение» — как читаемые строки в макете.
function Readline({ label, note, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '11px 13px', borderRadius: 10, background: 'var(--bg-2)', marginBottom: 8, minWidth: 0,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
      {note && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{note}</span>}
      <strong className="mono" style={{ marginLeft: 'auto', fontSize: 14.5, fontWeight: 800 }}>{value}</strong>
    </div>
  );
}

// Метрика результата.
function Metric({ label, value, sub, color }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', minWidth: 0, background: 'var(--surface)' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.5px', color: color || 'var(--text)', marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Редактируемый список статей: итог по списку стоит в заголовке, как в макете.
function ItemsEditor({ title, dot, hint, items, onChange, money, placeholder }) {
  const patch = (id, key, val) => onChange(items.map(it => (it.id === id ? { ...it, [key]: val } : it)));
  return (
    <div style={{ minWidth: 0, border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: hint ? 4 : 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: dot, flexShrink: 0 }} />
        <div style={{ fontWeight: 800, fontSize: 13.5 }}>{title}</div>
        <strong className="mono" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800 }}>{money(sumItems(items))}</strong>
      </div>
      {hint && <div style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>{hint}</div>}

      {items.map(it => (
        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,1fr) minmax(90px,140px) 30px', gap: 8, alignItems: 'center', marginBottom: 8, minWidth: 0 }}>
          <input className="input" style={{ minWidth: 0 }} value={it.name} maxLength={80}
            placeholder={placeholder} onChange={e => patch(it.id, 'name', e.target.value)} />
          <input className="input" style={{ minWidth: 0, textAlign: 'right', fontWeight: 700 }}
            type="text" inputMode="decimal" value={it.amount} placeholder="0"
            onChange={e => patch(it.id, 'amount', clean(e.target.value))}
            onBlur={() => patch(it.id, 'amount', norm(it.amount))} />
          <button className="btn btn-ghost btn-sm" aria-label="Удалить статью" title="Удалить статью"
            style={{ padding: '6px 0', justifyContent: 'center' }}
            onClick={() => onChange(items.filter(x => x.id !== it.id))}>×</button>
        </div>
      ))}

      <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
        onClick={() => onChange([...items, { id: uid(), name: '', amount: '' }])}>+ статья</button>
    </div>
  );
}

const EMPTY_FORM = {
  sub_price: '', invest: '', fixed_monthly: '', var_per_client: '',
  manual_revenue: '', manual_clients: '',
  plan_check: '', plan_clients: '', plan_revenue: '', plan_profit: '',
};

export default function BreakEven() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const [currency, setCurrency] = useState('UZS');
  const [mode, setMode] = useState('fact');        // fact | plan
  const [factSrc, setFactSrc] = useState('auto');  // auto | manual
  const months = useMemo(() => fullMonths(6), []);
  const [month, setMonth] = useState(months[0].key);
  // Пользователь мог сам переключить источник — ответ сервера не должен
  // возвращать переключатель обратно (пустые ручные поля читались как «Авто»).
  const factSrcTouched = useRef(false);
  // Какое из полей «чек»/«клиенты» правили последним: правка выручки двигает
  // противоположное. Без якоря цель менялась на каждый символ.
  const planAnchor = useRef(null);
  // Последний критерий прогноза нужен при изменении расходов: если человек задал
  // целевую прибыль — сохраняем цель, иначе сохраняем выбранный объём/цену.
  const planDriver = useRef('clients');
  const [form, setForm] = useState(EMPTY_FORM);
  const [manualMonths, setManualMonths] = useState({});
  const [fixedItems, setFixedItems] = useState([]);
  const [varItems, setVarItems] = useState([]);
  const [linkNote, setLinkNote] = useState(null);

  const apply = (d) => {
    const i = d.inputs || {};
    const autoClients = toNumber(d.auto?.clients);
    const hasSavedPlan = i.plan_check != null || i.plan_clients != null || i.plan_profit != null;
    const initialFixed = hasSavedPlan ? toNumber(i.fixed_monthly) : sumItems(i.fixed_items);
    const initialVarPer = hasSavedPlan
      ? toNumber(i.var_per_client)
      : (autoClients > 0 ? sumItems(i.var_items) / autoClients : 0);
    const initialCheck = toNumber(i.plan_check);
    const initialClients = toNumber(i.plan_clients);
    const initialRevenue = initialCheck * initialClients;
    const calculatedProfit = initialRevenue - initialFixed - initialVarPer * initialClients;

    setData(d);
    setCurrency(i.currency || 'UZS');
    setFixedItems(withIds(i.fixed_items));
    setVarItems(withIds(i.var_items));
    const mm = i.manual_months || {};
    setManualMonths(mm);
    if (!factSrcTouched.current) {
      setFactSrc(Object.keys(mm).length || i.manual_revenue != null || i.manual_clients != null ? 'manual' : 'auto');
    }
    const cur = mm[month] || {};
    planAnchor.current = 'check';
    planDriver.current = i.plan_profit == null ? 'clients' : 'profit';
    setForm({
      sub_price: numStr(i.sub_price ?? ''),
      invest: numStr(i.invest ?? i.fixed_costs ?? ''),
      fixed_monthly: numStr(trim2(initialFixed)),
      var_per_client: numStr(trim2(initialVarPer)),
      manual_revenue: numStr(cur.revenue ?? i.manual_revenue ?? ''),
      manual_clients: numStr(cur.clients ?? i.manual_clients ?? ''),
      plan_check: i.plan_check == null ? '' : numStr(i.plan_check),
      plan_clients: i.plan_clients == null ? '' : numStr(i.plan_clients),
      // Выручка прогноза отдельно не хранится — она производная от чека и клиентов.
      plan_revenue: i.plan_check == null || i.plan_clients == null ? '' : numStr(trim2(i.plan_check * i.plan_clients)),
      plan_profit: numStr(trim2(i.plan_profit == null ? calculatedProfit : i.plan_profit)),
    });
  };

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    api.get('/admin/bep')
      .then(r => { if (!ignore) apply(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  // Смена месяца подставляет сохранённый ручной факт этого месяца.
  const pickMonth = (key) => {
    setForm(f => ({
      ...f,
      manual_revenue: numStr(manualMonths[key]?.revenue ?? ''),
      manual_clients: numStr(manualMonths[key]?.clients ?? ''),
    }));
    setMonth(key);
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const blur = (key) => setForm(f => ({ ...f, [key]: norm(f[key]) }));

  const money = makeMoney(currency);
  const sym = SYMBOL[currency] || '';
  const auto = data?.auto || { companies: 0, branches: 0, clients: 0, revenue: 0 };

  // ── ФАКТ ────────────────────────────────────────────────────────────────
  const factClients = factSrc === 'auto' ? auto.clients : toNumber(form.manual_clients);
  // Считаем из ЖИВОГО поля абонплаты, а не из auto.revenue с сервера: иначе
  // подсказка под полем и само значение расходились до нажатия «Сохранить».
  const factRevenue = factSrc === 'auto'
    ? auto.branches * toNumber(form.sub_price)
    : toNumber(form.manual_revenue);
  const factFixed = sumItems(fixedItems);
  const factVarTotal = sumItems(varItems);
  const factVarPer = factClients > 0 ? factVarTotal / factClients : 0;

  const factCalc = calcBreakEven({
    revenue: factRevenue, clients: factClients,
    fixedTotal: factFixed, varPerClient: factVarPer, invest: form.invest,
    // В авто-режиме цена известна из настроек даже до подключения первого
    // филиала — точку безубыточности всё равно можно и нужно показать.
    checkOverride: factSrc === 'auto' ? form.sub_price : null,
    // Прибыль опирается на фактическую сумму статей: при нуле клиентов
    // произведение varPerClient × clients обнуляло весь список.
    variableTotalOverride: factVarTotal,
  });
  // ── ПРОГНОЗ: расходы — ручные вводные, все зависимые показатели считаются ──
  // При первом открытии структура берётся из факта, затем хранится явно в форме.
  const planFixedStr = form.fixed_monthly;
  const planVarStr = form.var_per_client;
  const planFixed = toNumber(planFixedStr);
  const planVarPer = toNumber(planVarStr);

  const planCalc = calcBreakEven({
    revenue: form.plan_revenue, clients: form.plan_clients,
    fixedTotal: planFixed, varPerClient: planVarPer, invest: form.invest,
    checkOverride: form.plan_check,
  });
  const calc = mode === 'fact' ? factCalc : planCalc;
  const shownClients = mode === 'fact' ? factClients : toNumber(form.plan_clients);

  // ── ПРОГНОЗ: связанные поля ─────────────────────────────────────────────
  const PLAN_KEY = { check: 'plan_check', clients: 'plan_clients', revenue: 'plan_revenue', profit: 'plan_profit' };
  const onPlan = (field, raw) => {
    const key = PLAN_KEY[field];
    const typed = clean(raw);
    const draft = { ...form, [key]: typed };
    const r = linkForecastFields(
      field,
      { check: draft.plan_check, clients: draft.plan_clients, revenue: draft.plan_revenue, profit: draft.plan_profit },
      // Структура для пересчёта — та же, что показана на экране: унаследованная
      // из факта, если её не правили. Иначе «целевая прибыль» считала бы по нулям.
      { fixedTotal: planFixed, varPerClient: planVarPer },
      { anchor: planAnchor.current },
    );
    if (field === 'check' || field === 'clients') planAnchor.current = field;
    planDriver.current = field;
    const next = { ...draft };
    r.changed.forEach(k => { next[PLAN_KEY[k]] = String(trim2(r.values[k])); });
    setForm(next);
    setLinkNote(r.reason);
  };

  const onPlanCost = (field, raw) => {
    const key = field === 'fixed' ? 'fixed_monthly' : 'var_per_client';
    const typed = clean(raw);
    const draft = { ...form, [key]: typed };
    const nextFixed = field === 'fixed' ? toNumber(typed) : toNumber(draft.fixed_monthly);
    const nextVarPer = field === 'var' ? toNumber(typed) : toNumber(draft.var_per_client);
    const r = linkForecastFields(
      'costs',
      { check: draft.plan_check, clients: draft.plan_clients, revenue: draft.plan_revenue, profit: draft.plan_profit },
      { fixedTotal: nextFixed, varPerClient: nextVarPer },
      { anchor: planAnchor.current, driver: planDriver.current },
    );
    const next = { ...draft };
    r.changed.forEach(k => { next[PLAN_KEY[k]] = String(trim2(r.values[k])); });
    setForm(next);
    setLinkNote(r.reason);
  };

  // Сброс прогноза к факту: и четыре связанных поля, и структура снова тянутся
  // из данных — то есть «посчитать всё автоматически» одной кнопкой.
  const fillPlanFromFact = () => {
    setLinkNote(null);
    planAnchor.current = 'check';
    planDriver.current = 'clients';
    setForm(f => ({
      ...f,
      plan_check: factCalc.check == null ? '' : String(trim2(factCalc.check)),
      plan_clients: String(trim2(factClients)),
      plan_revenue: String(trim2(factRevenue)),
      plan_profit: String(trim2(factCalc.profit)),
      fixed_monthly: String(trim2(factFixed)),
      var_per_client: String(trim2(factVarPer)),
    }));
  };

  // Первый заход в «Прогноз» с пустыми полями — подставляем факт, чтобы экран
  // не встречал человека нулями, которые он должен заполнить вручную.
  useEffect(() => {
    if (mode !== 'plan' || !data) return;
    const empty = !form.plan_check && !form.plan_clients && !form.plan_revenue;
    if (empty && (factRevenue > 0 || factClients > 0)) fillPlanFromFact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data]);

  const save = () => {
    setSaving(true); setError(null);
    const mm = { ...manualMonths };
    if (factSrc === 'manual') {
      mm[month] = { revenue: toMoneyOrNull(form.manual_revenue), clients: toMoneyOrNull(form.manual_clients) };
    }
    api.put('/admin/bep', {
      sub_price: toMoney(form.sub_price),
      invest: toMoney(form.invest),
      // Сохраняем то, что показано: унаследованное из факта, если не правили.
      fixed_monthly: toMoney(planFixedStr),
      var_per_client: toMoney(planVarStr),
      currency,
      fixed_items: packItems(fixedItems),
      var_items: packItems(varItems),
      manual_months: mm,
      // В режиме «Авто» одиночные ручные значения сбрасываем в null — так сервер
      // и экран после перезагрузки одинаково понимают, какой источник выбран.
      manual_revenue: factSrc === 'manual' ? toMoneyOrNull(form.manual_revenue) : null,
      manual_clients: factSrc === 'manual' ? toMoneyOrNull(form.manual_clients) : null,
      plan_check: toMoneyOrNull(form.plan_check),
      plan_clients: toMoneyOrNull(form.plan_clients),
      // Сохраняем только настоящую цель. Если прибыль была рассчитана от объёма,
      // после загрузки она снова выводится из чека, клиентов и расходов.
      plan_profit: planDriver.current === 'profit' ? toMoneyOrNull(form.plan_profit) : null,
    })
      .then(r => { apply(r.data); setSavedAt(Date.now()); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  // Вывод словами под результатом — как строка-итог в макете.
  const verdict = (() => {
    if (calc.beClientsCeil == null) return { tone: 'gray', text: reasonText(calc.beReason) };
    const need = Math.max(0, calc.beClientsCeil - Math.floor(shownClients || 0));
    if (calc.profit > 0) {
      return {
        tone: 'green',
        text: `Выше точки. Порог ${qty(calc.beClientsCeil)} — сейчас ${qty(shownClients)}. Прибыль ${money(calc.profit)}.`,
      };
    }
    return {
      tone: 'orange',
      text: `Ниже точки. Нужно ещё ${qty(need)} — порог ${qty(calc.beClientsCeil)}. Убыток ${money(Math.abs(calc.profit))}.`,
    };
  })();
  const VTONE = {
    green: { bg: 'rgba(29,122,53,.08)', bd: 'rgba(29,122,53,.3)', fg: '#1D7A35' },
    orange: { bg: 'rgba(217,119,6,.08)', bd: 'rgba(217,119,6,.3)', fg: '#B45309' },
    gray: { bg: 'var(--bg-2)', bd: 'var(--border)', fg: 'var(--text2)' },
  }[verdict.tone];

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, minWidth: 0 };

  return (
    <>
      <PageHeader
        title="Точка безубыточности"
        sub="Сколько филиалов и сколько денег нужно, чтобы платформа вышла в ноль"
        actions={<Pills value={currency} onChange={setCurrency} options={CUR_OPTS} label="Валюта" />}
        actionsKey={currency}
      />

      {error && <div style={{ ...card, marginBottom: 12, color: 'var(--red)' }}>{error}</div>}

      {loading ? (
        <div style={card}><Skeleton height={140} /></div>
      ) : !data ? null : (
        <>
          {/* Крупные вкладки Факт / Прогноз — как в макете */}
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-2)', marginBottom: 16 }}>
            {[{ v: 'fact', l: 'Факт' }, { v: 'plan', l: 'Прогноз' }].map(t => (
              <button key={t.v} type="button" onClick={() => setMode(t.v)}
                style={{
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
                  padding: '9px 22px', borderRadius: 9,
                  background: mode === t.v ? 'var(--surface)' : 'transparent',
                  color: mode === t.v ? 'var(--text)' : 'var(--text2)',
                  boxShadow: mode === t.v ? '0 1px 3px rgba(20,20,40,.12)' : 'none',
                }}>{t.l}</button>
            ))}
          </div>

          {/* Колонки задаются классом, а не инлайном: инлайновый
              grid-template-columns перебивает медиазапрос, и на телефоне экран
              оставался двухколоночным. */}
          <div className="bep-cols">
            {/* ── ЛЕВАЯ КОЛОНКА: ВВОД ─────────────────────────────── */}
            <div style={card}>
              {mode === 'fact' ? (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, minWidth: 0 }}>
                    <div style={{ minWidth: 0, maxWidth: '100%' }}>
                      <Pills value={factSrc} onChange={(v) => { factSrcTouched.current = true; setFactSrc(v); }} label="Источник данных"
                        options={[{ value: 'auto', label: 'Авто' }, { value: 'manual', label: 'Вручную' }]} />
                    </div>
                    <select className="input" value={month} onChange={e => pickMonth(e.target.value)}
                      style={{ flex: 1, minWidth: 180, fontWeight: 700 }}>
                      {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...hintStyle, marginTop: 0, marginBottom: 14 }}>
                    {factSrc === 'auto'
                      ? `Авто-срез: ${qty(auto.branches)} платящих филиалов в ${qty(auto.companies)} компаниях × абонплата. Истории начислений по месяцам у нас пока нет — за прошлый месяц вводите факт вручную.`
                      : 'Введите факт выбранного месяца. Значения сохраняются отдельно по каждому месяцу.'}
                  </div>

                  {/* Порядок строгий: что ВВОДЯТ — слева, что СЧИТАЕТСЯ — справа.
                      Раньше расчётная выручка стояла между двумя вводимыми полями,
                      и глазу было не за что зацепиться. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
                    {factSrc === 'auto' ? (
                      <>
                        <NumField label="1 · Абонплата за филиал в месяц" unit={sym} value={form.sub_price}
                          onChange={v => set('sub_price', v)} onBlur={() => blur('sub_price')} placeholder="1000"
                          hint="Единственное, что вводится вручную" />
                        <div style={{ minWidth: 0 }}>
                          <label className="label">2 · Клиентов за период</label>
                          <div style={{ ...fieldBox, background: 'var(--bg-2)', borderStyle: 'dashed' }} className="mono">{qty(factClients)} фил.</div>
                          <div style={hintStyle}>Платящие филиалы из базы</div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label className="label">3 · Выручка за период</label>
                          <div style={{ ...fieldBox, background: 'var(--bg-2)', borderStyle: 'dashed' }} className="mono">{money(factRevenue)}</div>
                          <div style={hintStyle}>{qty(auto.branches)} × {money(toNumber(form.sub_price))}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <NumField label="1 · Выручка за период" unit={sym} value={form.manual_revenue}
                          onChange={v => set('manual_revenue', v)} onBlur={() => blur('manual_revenue')} placeholder="0" />
                        <NumField label="2 · Клиентов за период" unit="фил." value={form.manual_clients}
                          onChange={v => set('manual_clients', v)} onBlur={() => blur('manual_clients')} placeholder="0" />
                      </>
                    )}
                  </div>

                  <div style={{ fontWeight: 900, fontSize: 15, margin: '18px 0 4px' }}>Расходы за период</div>
                  <div style={{ ...hintStyle, marginTop: 0, marginBottom: 12 }}>
                    Введите только статьи расходов — итоги и себестоимость система рассчитает сама.
                  </div>
                  <ItemsEditor title="Постоянные расходы" dot="#D97706" money={money}
                    hint="Не зависят от числа филиалов: серверы, зарплаты, аренда"
                    placeholder="Например, сервер" items={fixedItems} onChange={setFixedItems} />
                  <ItemsEditor title="Переменные расходы" dot="#DC2626" money={money}
                    hint="Растут вместе с числом филиалов: трафик, поддержка, эквайринг"
                    placeholder="Например, поддержка" items={varItems} onChange={setVarItems} />

                  <NumField label="Сумма инвестиций — вложено (для окупаемости)" unit={sym} value={form.invest}
                    onChange={v => set('invest', v)} onBlur={() => blur('invest')} placeholder="0" />

                  <div style={{ fontWeight: 900, fontSize: 15, margin: '20px 0 8px' }}>Автоматический расчёт</div>
                  <Readline label="Средний чек" note="(выручка / клиенты)" value={money(factCalc.check)} />
                  <Readline label="Переменная себестоимость" note="— на 1 клиента" value={money(factVarPer)} />
                  <Readline label="Полная себестоимость" note="— с постоянными" value={money(factCalc.fullCostPerClient)} />
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>Критерий прогноза</div>
                    <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>измените одно поле — остальные пересчитаются автоматически</span>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={fillPlanFromFact}>Взять из факта</button>
                  </div>
                  <div style={{ ...hintStyle, marginTop: 0, marginBottom: 14 }}>
                    Выручка = чек × клиенты. Из целевой прибыли считается нужное число филиалов.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
                    <NumField label="1 · Средний чек (цена)" unit={sym} value={form.plan_check}
                      onChange={v => onPlan('check', v)} onBlur={() => blur('plan_check')} placeholder="0" />
                    <NumField label="2 · Клиентов" unit="фил." value={form.plan_clients}
                      onChange={v => onPlan('clients', v)} onBlur={() => blur('plan_clients')} placeholder="0" />
                    <NumField label="3 · Выручка" unit={sym} value={form.plan_revenue}
                      onChange={v => onPlan('revenue', v)} onBlur={() => blur('plan_revenue')} placeholder="0" />
                    <NumField
                      label={planDriver.current === 'profit' ? '4 · Целевая прибыль' : '4 · Прибыль по плану'}
                      unit={sym} value={form.plan_profit}
                      onChange={v => onPlan('profit', v)} onBlur={() => blur('plan_profit')} placeholder="0"
                      hint={planDriver.current === 'profit'
                        ? 'Цель зафиксирована — рассчитаны нужные клиенты и выручка'
                        : 'Рассчитано автоматически; измените поле, чтобы задать цель'} />
                  </div>

                  {linkNote && <div style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--red)' }}>{reasonText(linkNote)}</div>}

                  <div style={{ fontWeight: 900, fontSize: 15, margin: '18px 0 4px' }}>Расходы</div>
                  <div style={{ ...hintStyle, marginTop: 0, marginBottom: 12 }}>
                    Эти значения вводятся вручную. Плановые показатели выше пересчитываются сразу.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                    <NumField label="5 · Постоянные расходы / мес" unit={sym} value={planFixedStr}
                      onChange={v => onPlanCost('fixed', v)} onBlur={() => blur('fixed_monthly')} placeholder="0" />
                    <NumField label="6 · Переменные на 1 клиента" unit={sym} value={planVarStr}
                      onChange={v => onPlanCost('var', v)} onBlur={() => blur('var_per_client')} placeholder="0" />
                    <NumField label="7 · Сумма инвестиций" unit={sym} value={form.invest}
                      onChange={v => set('invest', v)} onBlur={() => blur('invest')} placeholder="0" />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 170, justifyContent: 'center' }}>
                  {saving ? 'Сохранение…' : 'Сохранить и пересчитать'}
                </button>
                {savedAt && !saving && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>Сохранено</span>}
                {data.inputs?.updated_at && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Изменено: {new Date(data.inputs.updated_at).toLocaleString('ru-RU')}
                  </span>
                )}
              </div>
            </div>

            {/* ── ПРАВАЯ КОЛОНКА: РЕЗУЛЬТАТ И ГРАФИК ──────────────── */}
            <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
              <div style={card}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                  Результат — {mode === 'fact' ? 'факт' : 'прогноз'}
                </div>

                {/* Главная плитка: порог в филиалах и в деньгах */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2,
                  background: '#14141B', borderRadius: 14, overflow: 'hidden', marginBottom: 14,
                }}>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>Точка безубыточности</div>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.15 }}>
                      {calc.beClientsCeil == null ? '—' : qty(calc.beClientsCeil)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>филиалов</div>
                  </div>
                  <div style={{ padding: '16px 18px', borderLeft: '1px solid rgba(255,255,255,.12)' }}>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>&nbsp;</div>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.15 }}>
                      {short(calc.beSum, currency)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>выручки</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  <Metric label="Маржа с клиента" value={money(calc.marge)}
                    sub={calc.marge == null ? reasonText(calc.margeReason) : 'чек минус переменные'}
                    color={calc.marge != null && calc.marge < 0 ? '#B3261E' : undefined} />
                  <Metric label="Маржинальность" value={pct(calc.cmPct)}
                    sub={calc.cmPct == null ? reasonText(calc.cmReason) : 'после переменных'} />
                  <Metric label="Прибыль за период" value={money(calc.profit)}
                    sub={calc.profitable ? 'выручка минус все расходы' : 'расходы больше выручки'}
                    color={calc.profitable ? '#1D7A35' : '#B3261E'} />
                  <Metric label="Запас прочности" value={pct(calc.safetyPct)}
                    sub={calc.safetyPct == null ? reasonText(calc.safetyReason) : 'над порогом'}
                    color={calc.safetyPct != null && calc.safetyPct < 0 ? '#B3261E' : undefined} />
                  <Metric label="Окупаемость вложений"
                    value={calc.payback == null ? '∞' : `${fmtRu(trim2(calc.payback), 1)}`}
                    sub={calc.payback == null ? reasonText(calc.paybackReason) : 'месяцев'} />
                </div>

                <div style={{
                  marginTop: 12, padding: '11px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                  background: VTONE.bg, border: `1px solid ${VTONE.bd}`, color: VTONE.fg, fontWeight: 600,
                }}>
                  {verdict.text}
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  График безубыточности
                </div>
                {/* График ждёт СИМВОЛ валюты для подписи оси, а не код.
                    factClients — вертикаль «сейчас», чтобы было видно расстояние до порога. */}
                <BreakEvenChart chart={calc.chart} money={money} currency={sym}
                  beNote={reasonText(calc.beReason)} factClients={shownClients} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '14px 4px 0' }}>
            Клиент платформы — платящий филиал компании-клиента, средний чек — абонплата за филиал.
            Порог считается от структуры (чек, переменные на клиента, постоянные), а не от планового объёма:
            меняете цену — порог двигается, меняете только число филиалов — двигается отметка «сейчас».
          </div>
        </>
      )}
    </>
  );
}
