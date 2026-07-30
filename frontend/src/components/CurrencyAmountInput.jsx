import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../useTranslation.js';
import { normalizeDecimal } from '../utils/decimalInput.js';

// ── Деньги вводим ТЕКСТОМ, а не <input type="number"> ────────────────────────
// У type="number" Chrome на промежуточно-невалидном вводе («1500,», «1 500»,
// «12,5») отдаёт e.target.value === '': контролируемое поле само себя очищало,
// emit() считал сумму нулевой, а нативная валидация (required) вешала пузырь
// «Введите число» на визуально заполненном поле — касса не принимала и не
// выдавала деньги. type="text" + inputMode="decimal" даёт цифровую клавиатуру
// на телефоне и полный контроль над строкой.
//
// В onChange — только чистка символов (цифры, разделители, пробелы-разряды).
const cleanMoney = (s) => String(s ?? '')
  .replace(/[^\d.,\s\u00A0]/g, '')
  .replace(/[\s\u00A0]+/g, ' ');
// Строка → число через общий разборщик: два и больше разделителя — это разряды
// тысяч. Замена одной запятой на точку давала parseFloat('1.500.000') = 1.5,
// то есть цена в полтора миллиона уходила на сервер как полтора сума.
const toNum = (s) => {
  const raw = normalizeDecimal(s);
  if (!raw || raw === '.') return NaN;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};
// Нормализация на blur: то же число без хвостовых разделителей и пробелов.
const normMoney = (s) => {
  const n = toNum(s);
  return Number.isFinite(n) ? String(n) : '';
};

// Composite input: currency selector + amount-in-currency + manual exchange rate.
// Computes the UZS-equivalent amount on the fly and reports the full payload upward.
//
// Props:
//   value     — { currency, original_amount, exchange_rate } | null
//   onChange  — ({ currency, original_amount, exchange_rate, amountUZS }) => void
//   required  — boolean
//   label     — string (optional override)
//   showSummary — show "= X UZS" line below (default true)
export default function CurrencyAmountInput({ value, onChange, required, label, showSummary = true }) {
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const v = value || { currency: 'UZS', original_amount: '', exchange_rate: '' };
  const [touched, setTouched] = useState(false);

  // Текст полей живёт ЛОКАЛЬНО строкой (его можно стереть целиком, набрать
  // «1 500 000» или «12,5»), а наверх уходят уже нормализованные числа —
  // родитель постит original_amount/exchange_rate на сервер как есть, а там
  // parseFloat('1 500 000') дал бы 1.
  const [amtText, setAmtText] = useState(() => (v.original_amount == null ? '' : String(v.original_amount)));
  const [rateText, setRateText] = useState(() => (v.exchange_rate == null ? '' : String(v.exchange_rate)));
  // Что мы сами отдали наверх — чтобы обратная синхронизация не переписывала
  // текст под пальцами («1500,» → «1500»).
  const pushedRef = useRef(null);

  useEffect(() => {
    const p = pushedRef.current;
    if (p && p.currency === v.currency && p.original_amount === v.original_amount && p.exchange_rate === v.exchange_rate) return;
    // Значение пришло извне (сброс формы после успешной операции) — подхватываем.
    setAmtText(v.original_amount == null ? '' : String(v.original_amount));
    setRateText(v.exchange_rate == null ? '' : String(v.exchange_rate));
  }, [v.currency, v.original_amount, v.exchange_rate]);

  // Remember last manual rate per currency (per browser session) — сохраняем
  // только осмысленный курс, мусор восстанавливать нечего.
  useEffect(() => {
    if (!touched || !v.currency || v.currency === 'UZS') return;
    const r = toNum(rateText);
    if (!Number.isFinite(r) || r <= 0) return;
    try { sessionStorage.setItem('last_rate_' + v.currency, String(r)); } catch {}
  }, [v.currency, rateText, touched]);

  const push = (currency, amtStr, rateStr) => {
    const amt = toNum(amtStr);
    const rate = currency === 'UZS' ? 1 : toNum(rateStr);
    // amountUZS = 0 when either piece is missing/invalid — so backend rejects cleanly
    const valid = Number.isFinite(amt) && amt > 0 && Number.isFinite(rate) && rate > 0;
    const next = {
      currency,
      original_amount: Number.isFinite(amt) ? String(amt) : '',
      // Для UZS курс всегда 1: сервер пересчитывает сумму только когда и сумма,
      // и курс > 0 — с пустым курсом приход/расход отклонялся как «amount must be > 0».
      exchange_rate: currency === 'UZS' ? 1 : (Number.isFinite(rate) ? String(rate) : ''),
      amountUZS: valid ? (currency === 'UZS' ? amt : amt * rate) : 0,
    };
    pushedRef.current = {
      currency: next.currency,
      original_amount: next.original_amount,
      exchange_rate: next.exchange_rate,
    };
    onChange(next);
  };

  const updateCurrency = (cur) => {
    let rateStr = '';
    if (cur !== 'UZS') {
      // Restore last used rate for this currency
      let saved = NaN;
      try { saved = parseFloat(sessionStorage.getItem('last_rate_' + cur)); } catch {}
      rateStr = String(Number.isFinite(saved) && saved > 0 ? saved : suggestRate(cur));
    }
    setRateText(rateStr);
    push(cur, amtText, rateStr);
  };

  const onAmtChange = (e) => { const s = cleanMoney(e.target.value); setAmtText(s); push(v.currency, s, rateText); };
  const onAmtBlur = () => { const s = normMoney(amtText); setAmtText(s); push(v.currency, s, rateText); };
  const onRateChange = (e) => { setTouched(true); const s = cleanMoney(e.target.value); setRateText(s); push(v.currency, amtText, s); };
  const onRateBlur = () => { const s = normMoney(rateText); setRateText(s); push(v.currency, amtText, s); };

  const orig = toNum(amtText) || 0;
  const rate = v.currency === 'UZS' ? 1 : (toNum(rateText) || 0);
  const amountUZS = v.currency === 'UZS' ? orig : orig * rate;

  const CURRENCIES = [
    { code: 'UZS', label: 'UZS', flag: '🇺🇿' },
    { code: 'USD', label: 'USD', flag: '🇺🇸' },
    { code: 'EUR', label: 'EUR', flag: '🇪🇺' },
    { code: 'RUB', label: 'RUB', flag: '🇷🇺' },
    { code: 'KZT', label: 'KZT', flag: '🇰🇿' },
    { code: 'CNY', label: 'CNY', flag: '🇨🇳' },
    { code: 'TRY', label: 'TRY', flag: '🇹🇷' },
    { code: 'KRW', label: 'KRW', flag: '🇰🇷' },
    { code: 'GBP', label: 'GBP', flag: '🇬🇧' },
    { code: 'AED', label: 'AED', flag: '🇦🇪' },
  ];

  return (
    <div>
      <label className="label">{label || (uz ? 'Summa' : 'Сумма')}{required && ' *'}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
        <select className="input" value={v.currency} onChange={e => updateCurrency(e.target.value)}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
        </select>
        {/* required СНЯТ намеренно: на type="text" его пузырь всё равно ловил бы
            только пустое поле, а сумму проверяет сам экран (amountUZS > 0). */}
        <input className="input mono" type="text" inputMode="decimal"
          value={amtText} onChange={onAmtChange} onBlur={onAmtBlur}
          aria-required={required ? 'true' : undefined} placeholder="0" />
      </div>

      {v.currency !== 'UZS' && (
        <div style={{ marginTop: '8px' }}>
          <label className="label" style={{ fontSize: '11px' }}>
            {uz ? `Kurs (1 ${v.currency} = ? UZS)` : `Курс (1 ${v.currency} = ? UZS)`}
          </label>
          <input className="input mono" type="text" inputMode="decimal"
            value={rateText}
            onChange={onRateChange}
            onBlur={onRateBlur}
            placeholder={String(suggestRate(v.currency))} />
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
            {uz
              ? 'CB kursi yoki qo\'lda kiriting'
              : 'Курс ЦБ или вручную (можно отличаться)'}
          </div>
        </div>
      )}

      {showSummary && v.currency !== 'UZS' && orig > 0 && (
        <div style={{ background: 'rgba(67,56,202,.06)', borderRadius: '10px', padding: '10px 14px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>
            {uz ? 'UZS ekvivalent' : 'Экв. в UZS'}
          </span>
          <span className="mono" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)' }}>
            {Math.round(amountUZS).toLocaleString('ru-RU')} UZS
          </span>
        </div>
      )}
    </div>
  );
}

// Reasonable defaults (user can override) — fall-back when no sessionStorage value yet.
function suggestRate(currency) {
  return {
    USD: 12750, EUR: 13800, RUB: 140,
    KZT: 27, CNY: 1750, TRY: 350, KRW: 9.3, GBP: 16000, AED: 3470,
  }[currency] || 1;
}
