import React, { useEffect, useState } from 'react';
import { useTranslation } from '../useTranslation.js';

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

  // Remember last manual rate per currency (per browser session)
  useEffect(() => {
    if (v.currency && v.currency !== 'UZS' && touched) {
      try { sessionStorage.setItem('last_rate_' + v.currency, String(v.exchange_rate)); } catch {}
    }
  }, [v.currency, v.exchange_rate, touched]);

  const updateCurrency = (cur) => {
    let rate = 1;
    if (cur !== 'UZS') {
      // Restore last used rate for this currency
      const saved = parseFloat(sessionStorage.getItem('last_rate_' + cur));
      rate = Number.isFinite(saved) && saved > 0 ? saved : suggestRate(cur);
    }
    emit({ currency: cur, original_amount: v.original_amount, exchange_rate: rate });
  };

  const updateAmount = (val) => emit({ ...v, original_amount: val });
  const updateRate = (val) => { setTouched(true); emit({ ...v, exchange_rate: val }); };

  const emit = (next) => {
    const orig = parseFloat(next.original_amount);
    const rate = next.currency === 'UZS' ? 1 : parseFloat(next.exchange_rate);
    // amountUZS = 0 when either piece is missing/invalid — so backend rejects cleanly
    const valid = Number.isFinite(orig) && orig > 0 && Number.isFinite(rate) && rate > 0;
    const amountUZS = valid ? (next.currency === 'UZS' ? orig : orig * rate) : 0;
    // Keep raw input strings so the <input> doesn't get a leading 0 when user types.
    onChange({
      currency: next.currency,
      original_amount: next.original_amount,
      exchange_rate: next.exchange_rate,
      amountUZS,
    });
  };

  const orig = parseFloat(v.original_amount) || 0;
  const rate = v.currency === 'UZS' ? 1 : (parseFloat(v.exchange_rate) || 0);
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
        <input className="input mono" type="number" min="0" step="any"
          value={v.original_amount} onChange={e => updateAmount(e.target.value)}
          required={required} placeholder="0" />
      </div>

      {v.currency !== 'UZS' && (
        <div style={{ marginTop: '8px' }}>
          <label className="label" style={{ fontSize: '11px' }}>
            {uz ? `Kurs (1 ${v.currency} = ? UZS)` : `Курс (1 ${v.currency} = ? UZS)`}
          </label>
          <input className="input mono" type="number" min="0" step="any"
            value={v.exchange_rate}
            onChange={e => updateRate(e.target.value)}
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
