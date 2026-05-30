import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../useTranslation.js';

// Searchable product picker with native-feel styling that matches the app.
// Replaces ugly OS-styled <select> for product lists.
//
// Props:
//   products    — Array<{ id, name_ru, name_uz, barcode, unit, stock }>
//   value       — product id (number|string|'')
//   onChange    — (id) => void
//   placeholder
//   accent      — hex/CSS color for the active item highlight (default primary)
export default function ProductCombobox({ products, value, onChange, placeholder, accent }) {
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const ACC = accent || '#4338ca';
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const fmtQty = (v) => parseFloat(parseFloat(v || 0).toFixed(3)).toString();
  const nameOf = (p) => (uz && p.name_uz) ? p.name_uz : p.name_ru;

  const selected = products.find(p => String(p.id) === String(value));

  // Sync displayed text ONLY when the selected product changes (externally) or list loads.
  // Don't touch user-typed text just because the dropdown closed — that wipes their search.
  useEffect(() => {
    if (selected) setText(nameOf(selected));
  }, [value, products]);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setHighlight(-1); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = products.filter(p => {
    if (!text) return true;
    const q = text.toLowerCase();
    return (p.name_ru || '').toLowerCase().includes(q)
        || (p.name_uz || '').toLowerCase().includes(q)
        || (p.barcode || '').includes(text);
  });

  const pick = (p) => {
    onChange(String(p.id));
    setText(nameOf(p));
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.blur();
  };

  const clear = () => { onChange(''); setText(''); setOpen(false); setHighlight(-1); inputRef.current?.focus(); };

  const onKey = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); setHighlight(-1); inputRef.current?.blur(); }
  };

  // Keep highlighted row in view
  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={e => { setText(e.target.value); setOpen(true); setHighlight(0); if (value) onChange(''); }}
          onFocus={() => { setOpen(true); if (selected && text === nameOf(selected)) setText(''); }}
          onKeyDown={onKey}
          placeholder={placeholder || (uz ? 'Tovarni qidiring yoki tanlang...' : 'Найдите или выберите товар...')}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {value && (
          <button type="button" onClick={clear} title={uz ? 'Tozalash' : 'Очистить'}
            style={{ padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: '10px', background: '#fff', cursor: 'pointer', color: '#dc2626', fontSize: '16px', fontWeight: 700 }}>×</button>
        )}
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: '10px', background: '#fff', cursor: 'pointer', color: 'var(--text2)', fontSize: '12px' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div ref={listRef} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
          background: '#fff', border: '1px solid var(--border)', borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(26,27,46,.12), 0 4px 8px rgba(26,27,46,.06)',
          zIndex: 200, maxHeight: '320px', overflowY: 'auto', padding: '4px',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 12px', fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>
              {uz ? 'Hech narsa topilmadi' : 'Ничего не найдено'}
            </div>
          )}
          {filtered.map((p, i) => {
            const isSelected = String(p.id) === String(value);
            const isHi = i === highlight;
            const stockNum = parseFloat(p.stock || 0);
            const stockColor = stockNum <= 0 ? '#dc2626' : stockNum < 10 ? '#d97706' : '#16a34a';
            return (
              <div key={p.id} data-idx={i}
                onClick={() => pick(p)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', cursor: 'pointer', borderRadius: '8px',
                  background: isSelected ? ACC + '14' : isHi ? 'var(--bg-2)' : 'transparent',
                  transition: 'background-color .08s ease',
                }}>
                <span style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: isSelected ? ACC + '20' : 'var(--bg-2)',
                  color: isSelected ? ACC : 'var(--text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', flexShrink: 0, fontWeight: 800,
                }}>
                  📦
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nameOf(p)}
                  </div>
                  {p.barcode && (
                    <div className="mono" style={{ fontSize: '10.5px', color: 'var(--text3)', marginTop: '1px' }}>
                      {p.barcode}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: '13px', fontWeight: 800, color: stockColor }}>
                    {fmtQty(p.stock)} {p.unit}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 700 }}>
                    {uz ? 'qoldiq' : 'остаток'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
