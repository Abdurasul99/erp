import React, { useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { useMsg, formatLastLogin } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import { Icon } from '../icons.jsx';
import { AuthContext } from '../App.jsx';

const PW_HINT = 'Пароль минимум 8 символов и должен содержать букву и цифру';
const pwOk = (pw) => typeof pw === 'string' && pw.length >= 8 && /[a-zA-Zа-яА-Я]/.test(pw) && /[0-9]/.test(pw);
const ROLE_KEYS = { founder: 'founderRole', gen_dir: 'genDirRole', manager: 'managerRole', cashier: 'cashierRole', warehouse: 'warehouseRole', seller: 'sellerRole' };
const roleBadge = { founder: 'badge-blue', gen_dir: 'badge-blue', manager: 'badge-blue', cashier: 'badge-green', warehouse: 'badge-yellow', seller: 'badge-red' };
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

export default function GenDirUsers() {
  const { t } = useTranslation();
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers]       = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [searchText, setSearchText]     = useState('');
  const [editUser, setEditUser]   = useState(null);
  const [pwdChange, setPwdChange] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPwd, setNewPwd]       = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [msg, setMsg, clearMsg]   = useMsg();
  const [addForm, setAddForm]     = useState({ username: '', password: '', first_name: '', last_name: '', role: 'cashier', branch_id: '' });
  const [showAdd, setShowAdd]     = useState(false);
  const [showAddPass, setShowAddPass] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });

  useEffect(() => {
    load();
    api.get('/branches').then(r => setBranches(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const load = async () => {
    const { data } = await api.get('/users');
    setUsers(Array.isArray(data) ? data : []);
  };

  // Group by branch
  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(searchText.toLowerCase());
    const matchBranch = !filterBranch || String(u.branch_id) === filterBranch;
    return matchSearch && matchBranch;
  });

  const grouped = {};
  filtered.forEach(u => {
    const key = u.branch_id || 'none';
    if (!grouped[key]) grouped[key] = { name: u.branch_id ? (branchMap[u.branch_id] || `${t('branch')} #${u.branch_id}`) : t('noCompany'), users: [] };
    grouped[key].users.push(u);
  });

  const handleEditSave = async () => {
    try {
      await api.put(`/users/${editUser.id}`, { role: editUser.role, first_name: editUser.first_name || null, last_name: editUser.last_name || null, company_id: editUser.company_id, branch_id: editUser.branch_id || null });
      setMsg('success', t('success'));
      setEditUser(null);
      load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handlePwdSave = async () => {
    if (!pwOk(newPwd)) { setMsg('error', PW_HINT); return; }
    try {
      await api.post('/users/reset-password', { user_id: pwdChange.id, password: newPwd });
      setMsg('success', t('success'));
      setPwdChange(null); setNewPwd('');
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteConfirm.id}`);
      setDeleteConfirm(null); load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData(); fd.append('photo', file);
      const { data } = await api.post('/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfileUser(p => ({ ...p, photo: data.url }));
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
    finally { setUploadingPhoto(false); }
  };

  const handleProfileSave = async () => {
    try {
      const p = profileUser;
      await api.put(`/users/${p.id}/profile`, {
        photo: p.photo || null,
        birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : null,
        education: p.education || null, experience: p.experience || null, prev_jobs: p.prev_jobs || null,
        phone: p.phone || null, position: p.position || null,
        hired_at: p.hired_at ? String(p.hired_at).slice(0, 10) : null,
        profile_notes: p.profile_notes || null,
      });
      setMsg('success', t('success')); setProfileUser(null); load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleBlock = async (u) => {
    try {
      await api.put(`/users/${u.id}/block`, { is_blocked: !u.is_blocked });
      load();
    } catch {}
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await api.post('/branches', branchForm);
      setMsg('success', t('success'));
      setBranchForm({ name: '', address: '', phone: '' });
      setShowAddBranch(false);
      api.get('/branches').then(r => setBranches(r.data)).catch(() => {});
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!pwOk(addForm.password)) { setMsg('error', PW_HINT); return; }
    try {
      await api.post('/users', {
        username: addForm.username, password: addForm.password,
        first_name: addForm.first_name, last_name: addForm.last_name,
        role: addForm.role, branch_id: addForm.branch_id ? parseInt(addForm.branch_id) : null,
      });
      setMsg('success', `${t('success')}: ${addForm.first_name || addForm.username}`);
      setAddForm({ username: '', password: '', first_name: '', last_name: '', role: 'cashier', branch_id: '' });
      setShowAdd(false); load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  return (
    <div>
      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span>{msg.text}</span>
          <button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '160px' }}>
          <span style={{ color: 'var(--text3)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder={t('search') + '...'} />
        </div>
        <select className="input" style={{ width: '180px' }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">{t('allFilter')} {t('branches')}</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh')}</button>
        <button className="btn btn-orange btn-sm" onClick={() => { setShowAddBranch(v => !v); setShowAdd(false); }}>
          + {t('branches')}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(v => !v); setShowAddBranch(false); }}>
          + {t('addUser')}
        </button>
      </div>

      {/* Add branch form */}
      {showAddBranch && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-title">+ {t('branches')}</div>
          <form onSubmit={handleAddBranch}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label className="label">{t('branchName')} *</label>
                <input className="input" value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} placeholder={t('branchPlaceholder')} required />
              </div>
              <div>
                <label className="label">{t('address')}</label>
                <input className="input" value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('phone')}</label>
                <input className="input" value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary">{t('save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Add user form (collapsible) */}
      {showAdd && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-title">{t('addUser')}</div>
          <form onSubmit={handleAddUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label className="label">{t('firstName')}</label>
                <input className="input" value={addForm.first_name} onChange={e => setAddForm({ ...addForm, first_name: e.target.value })} placeholder={t('firstNamePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('lastName')}</label>
                <input className="input" value={addForm.last_name} onChange={e => setAddForm({ ...addForm, last_name: e.target.value })} placeholder={t('lastNamePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('username')}</label>
                <input className="input" value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} placeholder="login" required minLength={3} />
              </div>
              <div style={{ position: 'relative' }}>
                <label className="label">{t('password')}</label>
                <input className="input" type={showAddPass ? 'text' : 'password'} value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="****" required style={{ paddingRight: '40px' }} />
                <button type="button" onClick={() => setShowAddPass(v => !v)} style={{ position: 'absolute', right: '10px', top: '32px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name={showAddPass ? 'eyeOff' : 'eye'} size={15} color="#9EA3BF" />
                </button>
                <div style={{ fontSize: 11, color: addForm.password && !pwOk(addForm.password) ? '#EF4444' : '#9EA3BF', marginTop: 4 }}>{PW_HINT}</div>
              </div>
              <div>
                <label className="label">{t('role')}</label>
                <select className="input" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                  {['manager','cashier','warehouse','seller'].map(r => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('branch')}</label>
                <select className="input" value={addForm.branch_id} onChange={e => setAddForm({ ...addForm, branch_id: e.target.value })}>
                  <option value="">— {t('selectBranch')} —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary">{t('save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users grouped by branch */}
      {Object.entries(grouped).map(([key, group]) => (
        <div key={key} style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
            fontSize: '13px', fontWeight: 800, color: 'var(--text2)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {group.name}
            <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({group.users.length} {t('employees')})</span>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('username')}</th>
                  <th>{t('role')}</th>
                  <th>{t('branch')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('createdBy')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('lastLogin')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {group.users.map(u => (
                  <tr key={u.id} style={{ opacity: u.is_blocked ? 0.5 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(67,56,202,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="user" size={13} color="var(--primary)" />
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
                    <td style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {u.branch_id
                        ? <span style={{ background: 'rgba(67,56,202,.08)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '10px', fontWeight: 700, fontSize: '11px' }}>{branchMap[u.branch_id] || `#${u.branch_id}`}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {u.created_by_name
                        ? <span style={{ background: u.created_by_role === 'admin' ? 'rgba(107,111,138,.1)' : u.created_by_role === 'gen_dir' ? 'rgba(67,56,202,.1)' : 'rgba(34,197,94,.1)', color: u.created_by_role === 'admin' ? '#6B6F8A' : u.created_by_role === 'gen_dir' ? '#4338ca' : '#16a34a', padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>✎ {u.created_by_name}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
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
                      {u.is_blocked
                        ? <span className="badge badge-red">{t('blocked')}</span>
                        : <span className="badge badge-green">{t('active')}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button title={t('Профиль')} onClick={() => setProfileUser({ ...u })} style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', background: 'rgba(67,56,202,.08)' }}>📇</button>
                        <button className="action-btn action-btn-edit" title={t('edit')} onClick={() => setEditUser({ ...u })}>
                          <Icon name="edit" size={12} color="var(--primary)" />
                        </button>
                        <button className="action-btn action-btn-edit" title={t('changePassword')} onClick={() => { setPwdChange(u); setNewPwd(''); }}>
                          <Icon name="lock" size={12} color="var(--primary)" />
                        </button>
                        <button
                          title={u.is_blocked ? t('unblock') : t('block')}
                          onClick={() => handleBlock(u)}
                          style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', background: u.is_blocked ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)' }}
                        >{u.is_blocked ? '🔓' : '🔒'}</button>
                        <button className="action-btn action-btn-del" title={t('delete')} onClick={() => setDeleteConfirm(u)}>
                          <Icon name="trash" size={12} color="var(--red)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>{t('noData')}</div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{t('editUserTitle')} — {editUser.username}</div>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div><label className="label">{t('firstName')}</label><input className="input" value={editUser.first_name || ''} onChange={e => setEditUser({ ...editUser, first_name: e.target.value })} /></div>
              <div><label className="label">{t('lastName')}</label><input className="input" value={editUser.last_name || ''} onChange={e => setEditUser({ ...editUser, last_name: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="label">{t('role')}</label>
              <select className="input" value={editUser.role} onChange={e => {
                const r = e.target.value;
                setEditUser({ ...editUser, role: r, branch_id: r === 'gen_dir' ? null : editUser.branch_id });
              }}>
                {['gen_dir','manager','cashier','warehouse','seller'].map(r => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
              </select>
            </div>
            {editUser.role !== 'gen_dir' && (
            <div style={{ marginBottom: '20px' }}>
              <label className="label">{t('branch')} ({t('redistribution') || 'Перераспределить'})</label>
              <select className="input" value={editUser.branch_id || ''} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value ? parseInt(e.target.value) : null })}>
                <option value="">— {t('selectBranch')} —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>
                {t('moveBranchHint')}
              </div>
            </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={handleEditSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setEditUser(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {pwdChange && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '360px', width: '100%', margin: '0 20px', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '16px' }}>{t('changePassword')} — {pwdChange.username}</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input className="input" type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder={t('newPassword')} style={{ paddingRight: '44px' }} autoFocus />
              <div style={{ fontSize: 11, color: newPwd && !pwOk(newPwd) ? '#EF4444' : '#9EA3BF', marginTop: 6 }}>{PW_HINT}</div>
              <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: 'absolute', right: '12px', top: '22px', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name={showNewPwd ? 'eyeOff' : 'eye'} size={16} color="#9EA3BF" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={handlePwdSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setPwdChange(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '360px', width: '100%', margin: '0 20px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>{t('deleteUser')}</div>
            <div style={{ color: 'var(--text2)', marginBottom: '20px' }}>«{deleteConfirm.username}» {t('deleteConfirm')}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" onClick={handleDelete} style={{ flex: 1, justifyContent: 'center' }}>{t('delete')}</button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile modal — учредитель/менеджер заполняют полный профиль сотрудника */}
      {profileUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>👤 {t('Профиль')} — {fullName(profileUser)}</div>
              <button onClick={() => setProfileUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text3)' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--border)' }}>
                {profileUser.photo ? <img src={profileUser.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '34px' }}>👤</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  {uploadingPhoto ? t('Загрузка…') : t('📷 Загрузить фото')}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files?.[0])} />
                </label>
                {profileUser.photo && <button className="btn btn-ghost btn-sm" onClick={() => setProfileUser(p => ({ ...p, photo: null }))}>{t('Убрать')}</button>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div><label className="label">{t('Должность')}</label><input className="input" value={profileUser.position || ''} onChange={e => setProfileUser({ ...profileUser, position: e.target.value })} placeholder={t('напр. Старший продавец')} /></div>
              <div><label className="label">{t('Телефон')}</label><input className="input" value={profileUser.phone || ''} onChange={e => setProfileUser({ ...profileUser, phone: e.target.value })} placeholder="+998…" /></div>
              <div><label className="label">{t('Дата рождения')}</label><input className="input" type="date" value={profileUser.birth_date ? String(profileUser.birth_date).slice(0, 10) : ''} onChange={e => setProfileUser({ ...profileUser, birth_date: e.target.value })} /></div>
              <div><label className="label">{t('Дата приёма')}</label><input className="input" type="date" value={profileUser.hired_at ? String(profileUser.hired_at).slice(0, 10) : ''} onChange={e => setProfileUser({ ...profileUser, hired_at: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('Учебное заведение')}</label><input className="input" value={profileUser.education || ''} onChange={e => setProfileUser({ ...profileUser, education: e.target.value })} placeholder={t('ВУЗ / колледж · специальность')} /></div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('Опыт работы')}</label><textarea className="input" rows={2} value={profileUser.experience || ''} onChange={e => setProfileUser({ ...profileUser, experience: e.target.value })} placeholder={t('напр. 5 лет в рознице')} /></div>
            <div style={{ marginBottom: '12px' }}><label className="label">{t('Предыдущие места работы')}</label><textarea className="input" rows={3} value={profileUser.prev_jobs || ''} onChange={e => setProfileUser({ ...profileUser, prev_jobs: e.target.value })} placeholder={t('Компания · должность · годы…')} /></div>
            <div style={{ marginBottom: '18px' }}><label className="label">{t('Заметки')}</label><textarea className="input" rows={2} value={profileUser.profile_notes || ''} onChange={e => setProfileUser({ ...profileUser, profile_notes: e.target.value })} /></div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={handleProfileSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setProfileUser(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
