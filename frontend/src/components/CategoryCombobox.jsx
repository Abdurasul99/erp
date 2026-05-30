import React, { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';

// Editable dropdown: pick from saved presets, type free text, manage presets inline.
// Props:
//   value, onChange — current text value (string)
//   type — 'income' or 'expense'
//   placeholder — input placeholder
export default function CategoryCombobox({ value, onChange, type, placeholder }) {
  const { t } = useTranslation();
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [err, setErr] = useState('');
  const wrapRef = useRef(null);

  const load = () => api.get('/cash/categories', { params: { type } })
    .then(r => setCats(r.data)).catch(() => {});

  useEffect(() => { load(); }, [type]);

  // Click outside to close
  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setManaging(false); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pickCat = (name) => { onChange(name); setOpen(false); };

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    setErr('');
    try {
      await api.post('/cash/categories', { name, type });
      setNewCat('');
      load();
    } catch (e) { setErr(e.response?.data?.error || ''); }
  };

  const delCat = async (id, e) => {
    e.stopPropagation();
    try { await api.delete(`/cash/categories/${id}`); load(); } catch {}
  };

  // Filter shown options by current typed text
  const filtered = cats.filter(c => !value || c.name.toLowerCase().includes(value.toLowerCase()));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          className="input"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || t('selectOrType')}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ padding: '0 12px', border: '1.5px solid #E2E4F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#6B6F8A', fontSize: '14px' }}
          title={t('selectOrType')}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: '#fff', border: '1.5px solid #E2E4F0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 100, maxHeight: '280px', overflowY: 'auto',
        }}>
          {/* List */}
          {filtered.length === 0 && !managing && (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: '#9EA3BF', textAlign: 'center' }}>
              {t('noData')}
            </div>
          )}
          {filtered.map(c => (
            <div key={c.id}
              onClick={() => pickCat(c.name)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                background: value === c.name ? 'rgba(67,56,202,.08)' : 'transparent',
                borderBottom: '1px solid #F4F5FA',
              }}
              onMouseEnter={e => { if (value !== c.name) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (value !== c.name) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <button type="button" onClick={(e) => delCat(c.id, e)}
                title="×"
                style={{ background: 'rgba(239,68,68,.08)', border: 'none', color: '#dc2626', width: '22px', height: '22px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}

          {/* Add new */}
          <div style={{ padding: '8px 10px', background: '#F9FAFB', display: 'flex', gap: '6px' }}>
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
              placeholder={t('newCategory')}
              style={{ flex: 1, padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="button" onClick={addCat} disabled={!newCat.trim()}
              style={{ padding: '0 12px', background: newCat.trim() ? '#4338ca' : '#E2E4F0', color: '#fff', border: 'none', borderRadius: '7px', cursor: newCat.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px' }}>
              +
            </button>
          </div>
          {err && <div style={{ padding: '4px 12px 8px', color: '#dc2626', fontSize: '12px', fontWeight: 600, background: '#F9FAFB' }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
