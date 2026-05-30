import React, { useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { useMsg, formatLastLogin } from '../utils.js';
import { Icon } from '../icons.jsx';
import { useTranslation } from '../useTranslation.js';
import { AuthContext } from '../App.jsx';

const getRoles = (t) => [
  { key: 'gen_dir',   label: t('genDirRole'),   desc: t('genDirRoleDesc') },
  { key: 'manager',   label: t('managerRole'),   desc: t('managerRoleDesc') },
  { key: 'cashier',   label: t('cashierRole'),   desc: t('cashierRoleDesc') },
  { key: 'warehouse', label: t('warehouseRole'), desc: t('warehouseRoleDesc') },
  { key: 'seller',    label: t('sellerRole'),    desc: t('sellerRoleDesc') },
];
const ROLE_KEYS = { founder: 'founderRole', gen_dir: 'genDirRole', manager: 'managerRole', cashier: 'cashierRole', warehouse: 'warehouseRole', seller: 'sellerRole', admin: 'adminRole' };
const roleBadge = { founder: 'badge-blue', gen_dir: 'badge-blue', manager: 'badge-blue', cashier: 'badge-green', warehouse: 'badge-yellow', seller: 'badge-red' };
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

export default function UserManager() {
  const { t } = useTranslation();
  const { user: currentUser } = useContext(AuthContext);
  const ROLES = getRoles(t);
  const isAdmin = currentUser?.role === 'admin';
  const isGenDir = currentUser?.role === 'gen_dir';
  const canAdd = isAdmin || isGenDir;

  const [users, setUsers]       = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches]   = useState([]);
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', role: 'cashier', company_id: '', branch_id: '' });
  const [showPass, setShowPass]   = useState(false);
  const [msg, setMsg, clearMsg]   = useMsg();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pwdChange, setPwdChange] = useState(null);
  const [editUser, setEditUser]   = useState(null);
  const [editBranches, setEditBranches] = useState([]);
  const [newPwd, setNewPwd]   = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [searchUser, setSearchUser]   = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  useEffect(() => {
    load();
    if (canAdd || isAdmin) {
      api.get('/companies').then(r => setCompanies(r.data)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (form.company_id) {
      api.get(`/branches?company_id=${form.company_id}`).then(r => setBranches(r.data)).catch(() => {});
    } else { setBranches([]); setForm(f => ({ ...f, branch_id: '' })); }
  }, [form.company_id]);

  useEffect(() => {
    if (editUser?.company_id) {
      api.get(`/branches?company_id=${editUser.company_id}`).then(r => setEditBranches(r.data)).catch(() => {});
    } else setEditBranches([]);
  }, [editUser?.company_id]);

  const load = async () => { const { data } = await api.get('/users'); setUsers(data); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 4) { setMsg('error', t('minPassword')); return; }
    try {
      await api.post('/users', {
        username: form.username, password: form.password,
        first_name: form.first_name, last_name: form.last_name,
        role: form.role,
        company_id: form.company_id ? parseInt(form.company_id) : null,
        branch_id: form.branch_id ? parseInt(form.branch_id) : null,
      });
      setMsg('success', `${t('success')}: ${form.first_name || form.username}`);
      setForm({ username: '', password: '', first_name: '', last_name: '', role: 'cashier', company_id: '', branch_id: '' });
      load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleEditSave = async () => {
    try {
      await api.put(`/users/${editUser.id}`, {
        role: editUser.role,
        first_name: editUser.first_name || null,
        last_name: editUser.last_name || null,
        company_id: editUser.company_id || null,
        branch_id: editUser.branch_id || null,
      });
      setMsg('success', t('success'));
      setEditUser(null); load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/users/${deleteConfirm.id}`); setDeleteConfirm(null); load(); }
    catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handlePwdChange = async () => {
    if (!newPwd || newPwd.length < 4) return;
    try {
      await api.post('/users/reset-password', { user_id: pwdChange.id, password: newPwd });
      setPwdChange(null); setNewPwd('');
      setMsg('success', t('success'));
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleBlock = async (u) => {
    try { await api.put(`/users/${u.id}/block`, { is_blocked: !u.is_blocked }); load(); }
    catch {}
  };

  const filtered = users.filter(u => {
    const matchSearch = (u.username + ' ' + (u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(searchUser.toLowerCase());
    const matchCompany = !filterCompany || String(u.company_id) === filterCompany;
    return matchSearch && matchCompany;
  });

  // Group by company for display
  const grouped = {};
  filtered.forEach(u => {
    const key = u.company_id ? `c_${u.company_id}` : 'none';
    const label = companies.find(c => c.id === u.company_id)?.name || t('noCompany');
    if (!grouped[key]) grouped[key] = { label, users: [] };
    grouped[key].users.push(u);
  });

  const UserTable = ({ userList }) => (
    <table>
      <thead>
        <tr>
          <th>{t('fullNameLogin')}</th>
          <th>{t('role')}</th>
          {isAdmin && <th>{t('company')}</th>}
          <th>{t('branch')}</th>
          <th style={{ whiteSpace: 'nowrap' }}>{t('lastLogin')}</th>
          <th>{t('status')}</th>
          {canAdd && <th>{t('actions')}</th>}
        </tr>
      </thead>
      <tbody>
        {userList.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{t('noData')}</td></tr>}
        {userList.map(u => (
          <tr key={u.id} style={{ opacity: u.is_blocked ? 0.55 : 1 }}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(67,56,202,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="user" size={14} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {fullName(u)}
                    {u.is_blocked && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,.1)', color: 'var(--red)', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>🔒</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>@{u.username}</div>
                </div>
              </div>
            </td>
            <td><span className={`badge ${roleBadge[u.role] || 'badge-blue'}`}>{t(ROLE_KEYS[u.role]) || u.role}</span></td>
            {isAdmin && <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{companies.find(c => c.id === u.company_id)?.name || '—'}</td>}
            <td style={{ fontSize: '12px' }}>
              {u.branch_id ? <span style={{ background: 'rgba(67,56,202,.08)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, fontSize: '11px' }}>{t('branch')} #{u.branch_id}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
            </td>
            <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              {(() => {
                const ll = formatLastLogin(u.last_login_at, t);
                return (
                  <span style={{ background: ll.color + '18', color: ll.color, padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {ll.recent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ll.color }} />}
                    {ll.text}
                  </span>
                );
              })()}
            </td>
            <td>
              {u.is_blocked ? <span className="badge badge-red">{t('blocked')}</span> : <span className="badge badge-green">{t('active')}</span>}
            </td>
            {canAdd && (
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="action-btn action-btn-edit" title={t('edit')} onClick={() => setEditUser({ ...u })}>
                    <Icon name="edit" size={12} color="var(--primary)" />
                  </button>
                  <button className="action-btn action-btn-edit" title={t('changePassword')} onClick={() => { setPwdChange(u); setNewPwd(''); }}>
                    <Icon name="lock" size={12} color="var(--primary)" />
                  </button>
                  <button title={u.is_blocked ? 'Разблокировать' : 'Заблокировать'} onClick={() => handleBlock(u)}
                    style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', background: u.is_blocked ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)' }}>
                    {u.is_blocked ? '🔓' : '🔒'}
                  </button>
                  <button className="action-btn action-btn-del" title={t('delete')} onClick={() => setDeleteConfirm(u)}>
                    <Icon name="trash" size={12} color="var(--red)" />
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: canAdd ? 'minmax(300px,380px) 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
      {/* Add form — only for admin/gen_dir */}
      {canAdd && (
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="section-title">{t('addUser')}</div>
          {msg && <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{msg.text}</span><button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button></div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="label">{t('firstName')}</label>
                <input className="input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder={t('firstNamePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('lastName')}</label>
                <input className="input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder={t('lastNamePlaceholder')} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{t('loginLabel')}</label>
              <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username" required minLength={3} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{t('passwordLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: '44px' }} placeholder={t('minPassword')} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} color="#9EA3BF" />
                </button>
              </div>
            </div>
            {isAdmin && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">{t('company')}</label>
                  <select className="input" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value, branch_id: '' })}>
                    <option value="">{t('selectCompany')}</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {form.company_id && (
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label">{t('branch')}</label>
                    <select className="input" value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}>
                      <option value="">{t('selectBranch')}</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('role')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ROLES.map(r => (
                  <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: `2px solid ${form.role === r.key ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', background: form.role === r.key ? 'rgba(67,56,202,.04)' : 'transparent' }}>
                    <input type="radio" name="role" value={r.key} checked={form.role === r.key} onChange={() => setForm({ ...form, role: r.key })} style={{ accentColor: 'var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{r.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>{t('createUser')}</button>
          </form>
        </div>
      )}

      {/* Users list */}
      <div className="card">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="section-title" style={{ marginBottom: 0, flex: 1 }}>{t('systemUsers')}</div>
          <div className="search-bar" style={{ width: '200px' }}>
            <span style={{ color: 'var(--text3)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder={t('search') + '...'} />
          </div>
          {isAdmin && (
            <select className="input" style={{ width: '160px' }} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
              <option value="">{t('allCompanies')}</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh')}</button>
        </div>

        {isAdmin ? (
          Object.entries(grouped).map(([key, group]) => (
            <div key={key} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="store" size={13} color="var(--text2)" />
                {group.label} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({group.users.length})</span>
              </div>
              <UserTable userList={group.users} />
            </div>
          ))
        ) : (
          <UserTable userList={filtered} />
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{t('editUserTitle')} — @{editUser.username}</div>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text3)' }}>×</button>
            </div>
            <div className="form-grid" style={{ marginBottom: '14px' }}>
              <div><label className="label">{t('firstName')}</label><input className="input" value={editUser.first_name || ''} onChange={e => setEditUser({ ...editUser, first_name: e.target.value })} /></div>
              <div><label className="label">{t('lastName')}</label><input className="input" value={editUser.last_name || ''} onChange={e => setEditUser({ ...editUser, last_name: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="label">{t('role')}</label>
              <select className="input" value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
                {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            {isAdmin && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label className="label">{t('company')}</label>
                  <select className="input" value={editUser.company_id || ''} onChange={e => setEditUser({ ...editUser, company_id: e.target.value ? parseInt(e.target.value) : null, branch_id: null })}>
                    <option value="">— {t('selectCompany')} —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {editUser.company_id && (
                  <div style={{ marginBottom: '14px' }}>
                    <label className="label">{t('branch')}</label>
                    <select className="input" value={editUser.branch_id || ''} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value ? parseInt(e.target.value) : null })}>
                      <option value="">— {t('selectBranch')} —</option>
                      {editBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn btn-primary" onClick={handleEditSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setEditUser(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '380px', width: '100%', margin: '0 20px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>{t('deleteUser')}</div>
            <div style={{ color: 'var(--text2)', marginBottom: '20px' }}>«{fullName(deleteConfirm)}» {t('deleteConfirm')}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" onClick={handleDelete} style={{ flex: 1, justifyContent: 'center' }}>{t('delete')}</button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Change password */}
      {pwdChange && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '380px', width: '100%', margin: '0 20px', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '16px' }}>{t('changePassword')} — {fullName(pwdChange)}</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input className="input" type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder={t('newPassword')} style={{ paddingRight: '44px' }} autoFocus />
              <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name={showNewPwd ? 'eyeOff' : 'eye'} size={16} color="#9EA3BF" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={handlePwdChange} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setPwdChange(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
