import React, { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';

// Combobox backed by /api/suppliers. Allows inline creation with phone/email/contact.
// Props:
//   value     — supplier_id (string|number|null)
//   onChange  — (id|null) => void
//   placeholder
export default function SupplierCombobox({ value, onChange, placeholder }) {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [newS, setNewS] = useState({ name: '', phone: '', email: '', contact_person: '' });
  const [err, setErr] = useState('');
  const wrapRef = useRef(null);

  const load = () => api.get('/suppliers').then(r => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  // Keep displayed text in sync with selected id
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

  const pick = (s) => { onChange(s.id); setText(s.name); setOpen(false); };
  const clear = () => { onChange(null); setText(''); setOpen(false); };

  const handleAdd = async () => {
    if (!newS.name.trim()) { setErr('Введите имя'); return; }
    setErr('');
    try {
      const { data } = await api.post('/suppliers', {
        name: newS.name.trim(),
        phone: newS.phone.trim() || null,
        email: newS.email.trim() || null,
        contact_person: newS.contact_person.trim() || null,
      });
      setList(l => [data, ...l]);
      pick(data);
      setAdding(false);
      setNewS({ name: '', phone: '', email: '', contact_person: '' });
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };

  const filtered = list.filter(s => {
    if (!text) return true;
    const q = text.toLowerCase();
    return s.name.toLowerCase().includes(q)
        || (s.phone || '').includes(text)
        || (s.email || '').toLowerCase().includes(q)
        || (s.contact_person || '').toLowerCase().includes(q);
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          className="input"
          value={text}
          onChange={e => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || (t('supplierPlaceholder') || 'Выберите или введите...')}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {value && (
          <button type="button" onClick={clear}
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
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, maxHeight: '340px', overflowY: 'auto',
        }}>
          {filtered.length === 0 && !adding && (
            <div style={{ padding: '12px', fontSize: '13px', color: '#9EA3BF', textAlign: 'center' }}>
              {t('noData') || 'Не найдено'}
            </div>
          )}
          {filtered.map((s, i) => (
            <div key={s.id} onClick={() => pick(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', cursor: 'pointer', fontSize: '13px',
                background: value && Number(value) === s.id ? 'rgba(67,56,202,.08)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid #F4F5FA' : 'none',
              }}
              onMouseEnter={e => { if (!(value && Number(value) === s.id)) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!(value && Number(value) === s.id)) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(91,79,232,.10)', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>📦</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#1A1B2E' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#9EA3BF', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {s.phone && <span>📞 {s.phone}</span>}
                  {s.email && <span>✉️ {s.email}</span>}
                  {s.contact_person && <span>👤 {s.contact_person}</span>}
                </div>
              </div>
            </div>
          ))}

          {!adding && (
            <button type="button" onClick={() => setAdding(true)}
              style={{ width: '100%', padding: '10px 12px', background: '#F4F5FA', border: 'none', borderTop: '1px solid #E2E4F0', cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: '13px', color: '#4338ca', fontFamily: "'Nunito', sans-serif" }}>
              {t('newSupplier')}
            </button>
          )}
          {adding && (
            <div style={{ padding: '10px 12px', background: '#F9FAFB', borderTop: '1px solid #E2E4F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input autoFocus value={newS.name} onChange={e => setNewS({ ...newS, name: e.target.value })}
                placeholder={t('supplierName') + ' *'}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              <input value={newS.contact_person} onChange={e => setNewS({ ...newS, contact_person: e.target.value })}
                placeholder={t('contactPerson')}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              <input value={newS.phone} onChange={e => setNewS({ ...newS, phone: e.target.value })}
                placeholder={t('phone')}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              <input type="email" value={newS.email} onChange={e => setNewS({ ...newS, email: e.target.value })}
                placeholder={t('emailForOrders')}
                style={{ padding: '7px 10px', border: '1.5px solid #E2E4F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              {err && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>{err}</div>}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={handleAdd} disabled={!newS.name.trim()}
                  style={{ flex: 1, padding: '8px', background: newS.name.trim() ? '#4338ca' : '#E2E4F0', color: '#fff', border: 'none', borderRadius: '7px', cursor: newS.name.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px' }}>
                  {t('save')}
                </button>
                <button type="button" onClick={() => { setAdding(false); setErr(''); setNewS({ name: '', phone: '', email: '', contact_person: '' }); }}
                  style={{ flex: 1, padding: '8px', background: '#E2E4F0', color: '#6B6F8A', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
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
