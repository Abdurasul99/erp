import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { formatDate, fmtMoney, useMsg } from '../utils.js';
import DebtsPanel from './DebtsPanel.jsx';

export default function SuppliersManager() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null); // null | 'new' | {supplier}
  const [debtsFor, setDebtsFor] = useState(null); // supplier record (we owe)
  const [form, setForm] = useState({ name: '', phone: '', email: '', contact_person: '', address: '', note: '' });
  const [err, setErr] = useState('');
  const [msg, setMsg, clearMsg] = useMsg();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/suppliers'); setList(data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = list.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q)
        || (s.phone || '').includes(search)
        || (s.email || '').toLowerCase().includes(q)
        || (s.contact_person || '').toLowerCase().includes(q);
  });

  const withEmail = filtered.filter(s => s.email).length;
  const totalValue = filtered.reduce((s, x) => s + parseFloat(x.total_value || 0), 0);

  const openNew = () => { setEdit('new'); setForm({ name: '', phone: '', email: '', contact_person: '', address: '', note: '' }); setErr(''); };
  const openEdit = (s) => { setEdit(s); setForm({
    name: s.name, phone: s.phone || '', email: s.email || '',
    contact_person: s.contact_person || '', address: s.address || '', note: s.note || '',
  }); setErr(''); };

  const save = async () => {
    if (!form.name.trim()) { setErr(t('enterName')); return; }
    try {
      if (edit === 'new') await api.post('/suppliers', form);
      else                await api.put(`/suppliers/${edit.id}`, form);
      setMsg('success', t('successGeneric'));
      setEdit(null);
      load();
    } catch (e) { setErr(e.response?.data?.error || t('errorGeneric')); }
  };

  const del = async (s) => {
    if (!window.confirm(`${t('deleteConfirm')} «${s.name}»?`)) return;
    try { await api.delete(`/suppliers/${s.id}`); load(); }
    catch (e) { setMsg('error', e.response?.data?.error || t('errorGeneric')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 0 }}>
      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">{t('totalSuppliers') || 'Поставщики'}</div>
          <div className="stat-value mono" style={{ color: 'var(--primary)' }}>{filtered.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="stat-label">{t('withEmail') || 'С email'}</div>
          <div className="stat-value mono" style={{ color: 'var(--green)' }}>{withEmail}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--orange)' }}>
          <div className="stat-label">{t('totalIncomeValue') || 'Сумма закупок'}</div>
          <div className="stat-value mono" style={{ color: 'var(--orange)', fontSize: '20px' }}>{fmtMoney(totalValue)}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0, marginRight: 'auto' }}>📦 {t('suppliers') || 'Поставщики'}</div>
          <input className="input" style={{ width: '220px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`🔍 ${t('search') || 'Поиск'}`} />
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('addSupplier') || 'Добавить'}</button>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh') || 'Обновить'}</button>
        </div>

        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}<button onClick={clearMsg} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>×</button></div>}

        {loading ? (
          <div className="center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('name') || 'Название'}</th>
                  <th>{t('contactPerson') || 'Контакт'}</th>
                  <th>{t('phone') || 'Телефон'}</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>{t('incomes') || 'Поставок'}</th>
                  <th style={{ textAlign: 'right' }}>{t('totalIncomeValue') || 'Сумма'}</th>
                  <th style={{ textAlign: 'right' }}>{t('weOwe') || 'Наш долг'}</th>
                  <th>{t('lastIncome') || 'Последняя'}</th>
                  <th>{t('actions') || 'Действия'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData') || 'Нет данных'}</td></tr>}
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      {s.address && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{s.address}</div>}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{s.contact_person || '—'}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text2)' }}>
                      {s.phone
                        ? <a href={`tel:${s.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.phone}</a>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {s.email
                        ? <a href={`mailto:${s.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.email}</a>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.income_count || 0}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {parseFloat(s.total_value) > 0
                        ? <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(s.total_value)}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {parseFloat(s.debt_amount) > 0
                        ? <button onClick={() => setDebtsFor(s)}
                            style={{ background: 'rgba(220,38,38,.08)', border: 'none', color: 'var(--red)', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmtMoney(s.debt_amount)}
                          </button>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{s.last_income_at ? formatDate(s.last_income_at) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)} title="Изменить">✏️</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => del(s)} title="Удалить" style={{ color: 'var(--red)' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {debtsFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDebtsFor(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px', width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '18px' }}>📒 Наш долг: {debtsFor.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{[debtsFor.contact_person, debtsFor.phone, debtsFor.email].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => setDebtsFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <DebtsPanel mode="supplier" id={debtsFor.id} />
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setEdit(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{edit === 'new' ? t('newSupplier') : t('editSupplier')}</div>
              <button onClick={() => setEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('name') || 'Название'} *</label><input autoFocus className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('contactPerson') || 'Контактное лицо'}</label><input className="input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div><label className="label">{t('phone') || 'Телефон'}</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+998..." /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="..." /></div>
            </div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('address') || 'Адрес'}</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div style={{ marginBottom: '16px' }}><label className="label">{t('note') || 'Примечание'}</label><textarea className="input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            {err && <div className="alert alert-error">{err}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={save} style={{ flex: 1, justifyContent: 'center' }}>{t('save') || 'Сохранить'}</button>
              <button className="btn btn-ghost" onClick={() => setEdit(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel') || 'Отмена'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
