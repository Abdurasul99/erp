import React, { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';

// Searchable combobox for picking a customer. Allows creating a new one inline.
// Props:
//   value      — customer_id (string|number|null)
//   onChange   — (id|null) => void
//   placeholder
export default function CustomerCombobox({ value, onChange, placeholder }) {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [newC, setNewC] = useState({ name: '', phone: '' });
  const [err, setErr] = useState('');
  const wrapRef = useRef(null);

  const load = () => api.get('/customers').then(r => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  // Keep text input in sync with selected customer
  useEffect(() => {
    if (!value) { setText(''); return; }
    const found = list.find(c => c.id === Number(value));
    if (found) setText(found.name);
  }, [value, list]);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setAdding(false); setErr(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (c) => { onChange(c.id); setText(c.name); setOpen(false); };
  const clear = () => { onChange(null); setText(''); setOpen(false); };

  const handleAdd = async () => {
    if (!newC.name.trim()) return;
    setErr('');
    try {
      const { data } = await api.post('/customers', { name: newC.name.trim(), phone: newC.phone.trim() || null });
      setList(l => [data, ...l]);
      pick(data);
      setAdding(false);
      setNewC({ name: '', phone: '' });
    } catch (e) { setErr(e.response?.data?.error || 'Error'); }
  };

  const filtered = list.filter(c => {
    if (!text) return true;
    const q = text.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone || '').includes(text);
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          className="input"
          value={text}
          onChange={e => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || (t('selectOrType') || 'Mijozni tanlang...')}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {value && (
          <button type="button" onClick={clear}
            title="×"
            style={{ padding: '0 12px', border: '1.5px solid #E2E4F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#dc2626', fontSize: '16px', fontWeight: 700 }}>×</button>
        )}
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ padding: '0 12px', border: '1.5px solid #E2E4F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#6B6F8A', fontSize: '14px' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: '#fff', border: '1.5px solid #E2E4F0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, maxHeight: '320px', overflowY: 'auto',
        }}>
          {/* List */}
          {filtered.length === 0 && !adding && (
            <div style={{ padding: '12px', fontSize: '13px', color: '#9EA3BF', textAlign: 'center' }}>
              {text ? (t('noData') || 'Не найдено') : (t('noData') || 'Нет данных')}
            </div>
          )}
          {filtered.map((c, i) => (
            <div key={c.id}
              onClick={() => pick(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', cursor: 'pointer', fontSize: '13px',
                background: value && Number(value) === c.id ? 'rgba(67,56,202,.08)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid #F4F5FA' : 'none',
              }}
              onMouseEnter={e => { if (!(value && Number(value) === c.id)) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!(value && Number(value) === c.id)) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(91,79,232,.10)', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>👤</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#1A1B2E' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: '#9EA3BF', display: 'flex', gap: '8px' }}>
                  {c.phone && <span>📞 {c.phone}</span>}
                  {parseFloat(c.debt_amount) > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      Долг: {parseFloat(c.debt_amount).toLocaleString('ru-RU')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add new */}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)}
              style={{ width: '100%', padding: '10px 12px', background: '#F4F5FA', border: 'none', borderTop: '1px solid #E2E4F0', cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: '13px', color: '#4338ca', fontFamily: "'Nunito', sans-serif" }}>
              {t('newCustomer')}
            </button>
          )}
          {adding && (
            <div style={{ padding: '10px 12px', background: '#F9FAFB', borderTop: '1px solid #E2E4F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                autoFocus
                value={newC.name}
                onChange={e => setNewC({ ...newC, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                placeholder={t('customerName')}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                value={newC.phone}
                onChange={e => setNewC({ ...newC, phone: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                placeholder={t('phone')}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              />
              {err && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>{err}</div>}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={handleAdd} disabled={!newC.name.trim()}
                  style={{ flex: 1, padding: '7px', background: newC.name.trim() ? '#4338ca' : '#E2E4F0', color: '#fff', border: 'none', borderRadius: '7px', cursor: newC.name.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
                  {t('save')}
                </button>
                <button type="button" onClick={() => { setAdding(false); setErr(''); setNewC({ name: '', phone: '' }); }}
                  style={{ flex: 1, padding: '7px', background: '#E2E4F0', color: '#6B6F8A', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
