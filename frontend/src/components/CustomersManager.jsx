import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { formatDate, fmtMoney, useMsg } from '../utils.js';
import DebtsPanel from './DebtsPanel.jsx';

export default function CustomersManager() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null); // null | 'new' | {customer}
  const [debtorOnly, setDebtorOnly] = useState(false);
  const [debtsFor, setDebtsFor] = useState(null); // customer record
  const [form, setForm] = useState({ name: '', phone: '', note: '', source: '' });
  const [err, setErr] = useState('');
  const [msg, setMsg, clearMsg] = useMsg();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/customers'); setList(data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = list.filter(c => {
    if (debtorOnly && !(parseFloat(c.debt_amount) > 0)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone || '').includes(search);
  });

  const totalDebt = filtered.reduce((s, c) => s + parseFloat(c.debt_amount || 0), 0);
  const withDebt = filtered.filter(c => parseFloat(c.debt_amount) > 0).length;

  const openNew = () => { setEdit('new'); setForm({ name: '', phone: '', note: '', source: '' }); setErr(''); };
  const openEdit = (c) => { setEdit(c); setForm({ name: c.name, phone: c.phone || '', note: c.note || '', source: c.source || '' }); setErr(''); };

  const save = async () => {
    if (!form.name.trim()) { setErr(t('enterName')); return; }
    try {
      if (edit === 'new') {
        await api.post('/customers', form);
      } else {
        await api.put(`/customers/${edit.id}`, form);
      }
      setMsg('success', t('successGeneric'));
      setEdit(null);
      load();
    } catch (e) { setErr(e.response?.data?.error || t('errorGeneric')); }
  };

  const del = async (c) => {
    if (!window.confirm(`${t('deleteConfirm')} «${c.name}»?`)) return;
    try { await api.delete(`/customers/${c.id}`); load(); }
    catch (e) { setMsg('error', e.response?.data?.error || t('errorGeneric')); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 0 }}>
      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">{t('totalCustomers') || 'Клиентов'}</div>
          <div className="stat-value mono" style={{ color: 'var(--primary)' }}>{filtered.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--orange)' }}>
          <div className="stat-label">{t('withDebt') || 'С долгом'}</div>
          <div className="stat-value mono" style={{ color: 'var(--orange)' }}>{withDebt}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--red)' }}>
          <div className="stat-label">{t('totalDebt') || 'Сумма долга'}</div>
          <div className="stat-value mono" style={{ color: 'var(--red)', fontSize: '20px' }}>{fmtMoney(totalDebt)}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0, marginRight: 'auto' }}>👥 {t('customers') || 'Клиенты'}</div>
          <input className="input" style={{ width: '220px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`🔍 ${t('search') || 'Поиск'}`} />
          <button className={`btn btn-sm ${debtorOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDebtorOnly(v => !v)}>
            📒 {t('debtorOnly') || 'Только должники'} {withDebt > 0 && `(${withDebt})`}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('addCustomer') || 'Добавить'}</button>
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
                  <th>{t('name') || 'Имя'}</th>
                  <th>{t('phone') || 'Телефон'}</th>
                  <th>{t('note') || 'Примечание'}</th>
                  <th style={{ textAlign: 'right' }}>{t('debts') || 'Долгов'}</th>
                  <th style={{ textAlign: 'right' }}>{t('debtAmount') || 'Сумма долга'}</th>
                  <th>{t('createdAt') || 'Создан'}</th>
                  <th>{t('actions') || 'Действия'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData') || 'Нет данных'}</td></tr>}
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td><div style={{ fontWeight: 700 }}>{c.name}</div></td>
                    <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {c.debts_count > 0 ? <span style={{ background: 'rgba(245,158,11,.15)', color: '#d97706', padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '12px' }}>{c.debts_count}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {parseFloat(c.debt_amount) > 0
                        ? <button onClick={() => setDebtsFor(c)}
                            style={{ background: 'rgba(220,38,38,.08)', border: 'none', color: 'var(--red)', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmtMoney(c.debt_amount)}
                          </button>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => del(c)} style={{ color: 'var(--red)' }}>🗑</button>
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
                <div style={{ fontWeight: 800, fontSize: '18px' }}>📒 {debtsFor.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{debtsFor.phone || ''}</div>
              </div>
              <button onClick={() => setDebtsFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <DebtsPanel mode="customer" id={debtsFor.id} />
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setEdit(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{edit === 'new' ? t('newCustomer') : t('editCustomer')}</div>
              <button onClick={() => setEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('name') || 'Имя'} *</label><input className="input" autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('phone') || 'Телефон'}</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+998..." /></div>
            <div style={{ marginBottom: '12px' }}>
              <label className="label">Откуда пришёл клиент</label>
              <select className="input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                <option value="">— не указан —</option>
                <option value="instagram">📷 Instagram</option>
                <option value="telegram">✈️ Telegram</option>
                <option value="referral">🤝 Сарафан / рекомендация</option>
                <option value="ads">📣 Реклама</option>
                <option value="walk_in">🚶 Прохожий</option>
                <option value="marketplace">🛒 Маркетплейс</option>
                <option value="other">📌 Другое</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Канал нужен для аналитики ROI в разделе Маркетинг → Каналы</div>
            </div>
            <div style={{ marginBottom: '16px' }}><label className="label">{t('note') || 'Примечание'}</label><textarea className="input" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
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
