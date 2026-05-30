import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useMsg, formatLastLogin, filterByPeriod } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import { Icon } from '../icons.jsx';
import PeriodFilter from './PeriodFilter.jsx';

const ROLE_KEYS = { founder: 'founderRole', gen_dir: 'genDirRole', manager: 'managerRole', cashier: 'cashierRole', warehouse: 'warehouseRole', seller: 'sellerRole', admin: 'adminRole' };
const roleBadge = { founder: 'badge-blue', gen_dir: 'badge-blue', manager: 'badge-blue', cashier: 'badge-green', warehouse: 'badge-yellow', seller: 'badge-red' };
const roleColor = { founder: '#7c3aed', gen_dir: '#4338ca', manager: '#4338ca', cashier: '#16a34a', warehouse: '#d97706', seller: '#dc2626' };
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

const roleColor2 = { admin: '#6B6F8A', founder: '#7c3aed', gen_dir: '#4338ca', manager: '#4338ca', cashier: '#16a34a', warehouse: '#d97706', seller: '#dc2626' };
const creatorBadge = (role) => {
  if (role === 'admin') return { bg: 'rgba(107,111,138,.1)', color: '#6B6F8A' };
  if (role === 'founder') return { bg: 'rgba(124,58,237,.1)', color: '#7c3aed' };
  if (role === 'gen_dir') return { bg: 'rgba(67,56,202,.1)', color: '#4338ca' };
  if (role === 'manager') return { bg: 'rgba(67,56,202,.08)', color: '#4338ca' };
  return { bg: 'rgba(156,163,175,.1)', color: '#9EA3BF' };
};

export default function AdminPanel() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [roleLog, setRoleLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [logPeriod, setLogPeriod] = useState('month');
  const [logCustomRange, setLogCustomRange] = useState({ from: '', to: '' });
  const [expanded, setExpanded] = useState({});
  const [expandedBranch, setExpandedBranch] = useState({});
  const [msg, setMsg, clearMsg] = useMsg();
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, b, u, log] = await Promise.all([
        api.get('/companies'),
        api.get('/branches'),
        api.get('/users'),
        api.get('/role-change-log').catch(() => ({ data: [] })),
      ]);
      setCompanies(c.data);
      setAllBranches(b.data);
      setAllUsers(u.data);
      setRoleLog(log.data);
      if (c.data.length > 0 && Object.keys(expanded).length === 0) {
        setExpanded({ [c.data[0].id]: true });
      }
    } catch {}
    setLoading(false);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getBranches = (companyId) => allBranches.filter(b => b.company_id === companyId);
  // Company-level roles (founder, gen_dir) are not branch-level — exclude from branch lists
  const isCompanyLevel = (r) => r === 'founder' || r === 'gen_dir';
  const getBranchUsers = (branchId) => allUsers.filter(u => u.branch_id === branchId && !isCompanyLevel(u.role));
  const getCompanyDirectors = (companyId) => allUsers.filter(u => u.company_id === companyId && isCompanyLevel(u.role));
  const getCompanyFounder   = (companyId) => allUsers.find(u => u.company_id === companyId && u.role === 'founder');
  const getCompanyGenDir    = (companyId) => allUsers.find(u => u.company_id === companyId && u.role === 'gen_dir');
  const unassignedUsers = allUsers.filter(u => !u.company_id && u.role !== 'admin');

  const stats = [
    { label: t('totalCompanies'), value: companies.length, icon: 'store', color: '#4338ca' },
    { label: t('totalBranches'),  value: allBranches.length, icon: 'box', color: '#FF6B2B' },
    { label: t('totalStaff'),     value: allUsers.length, icon: 'users', color: '#16a34a' },
    { label: t('totalBlocked'),   value: allUsers.filter(u => u.is_blocked).length, icon: 'lock', color: '#dc2626' },
  ];

  // ─── Search filter ────────────────────────────────────────────────────────────
  const lc = search.toLowerCase();
  const matchCompany = (c) => !search || c.name.toLowerCase().includes(lc);
  const matchBranch = (b) => !search || b.name.toLowerCase().includes(lc);
  const matchUser = (u) => !search || fullName(u).toLowerCase().includes(lc) || u.username.toLowerCase().includes(lc) || (t(ROLE_KEYS[u.role])||'').toLowerCase().includes(lc);

  // ─── CRUD ─────────────────────────────────────────────────────────────────────
  const openModal = (type, data = {}) => { setActiveModal(type); setModalData(data); clearMsg(); };
  const closeModal = () => { setActiveModal(null); setModalData({}); };

  const handleCreate = async () => {
    try {
      if (activeModal === 'company') {
        await api.post('/companies', modalData);
      } else if (activeModal === 'branch') {
        await api.post('/branches', modalData);
      } else if (activeModal === 'user') {
        if (!modalData.password || modalData.password.length < 4) { setMsg('error', t('minPassword')); return; }
        await api.post('/users', modalData);
      }
      setMsg('success', t('success'));
      closeModal();
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleEdit = async () => {
    try {
      if (activeModal === 'editCompany') {
        await api.put(`/companies/${modalData.id}`, modalData);
      } else if (activeModal === 'editBranch') {
        await api.put(`/branches/${modalData.id}`, modalData);
      } else if (activeModal === 'editUser') {
        await api.put(`/users/${modalData.id}`, modalData);
      }
      setMsg('success', t('success'));
      closeModal();
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`${t('delete')} "${name}"?`)) return;
    try {
      if (type === 'company') await api.delete(`/companies/${id}`);
      else if (type === 'branch') await api.delete(`/branches/${id}`);
      else if (type === 'user') await api.delete(`/users/${id}`);
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleBlock = async (user) => {
    try { await api.put(`/users/${user.id}/block`, { is_blocked: !user.is_blocked }); loadAll(); } catch {}
  };

  const handleResetPwd = async () => {
    if (!modalData.newPassword || modalData.newPassword.length < 4) { setMsg('error', t('minPassword')); return; }
    try {
      await api.post('/users/reset-password', { user_id: modalData.id, password: modalData.newPassword });
      setMsg('success', t('success'));
      closeModal();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  // ─── UI Components ─────────────────────────────────────────────────────────
  const CreatorTag = ({ name, role }) => {
    if (!name) return null;
    const style = creatorBadge(role);
    return (
      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, background: style.bg, color: style.color, flexShrink: 0 }}>
        ✎ {name}
      </span>
    );
  };

  const UserRow = ({ u }) => {
    if (!matchUser(u)) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: u.is_blocked ? 'rgba(239,68,68,.04)' : 'rgba(0,0,0,.01)', marginBottom: '2px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: roleColor[u.role] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="user" size={13} color={roleColor[u.role] || '#6B6F8A'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(u)}</span>
            <span style={{ fontSize: '11px', color: '#9EA3BF', fontWeight: 400, flexShrink: 0 }}>@{u.username}</span>
            {u.is_blocked && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,.1)', color: '#dc2626', padding: '1px 5px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>🔒</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>
            <span className={`badge ${roleBadge[u.role] || 'badge-blue'}`} style={{ fontSize: '10px', padding: '1px 7px' }}>{t(ROLE_KEYS[u.role]) || u.role}</span>
            {u.created_by_name && <CreatorTag name={u.created_by_name} role={u.created_by_role} />}
            {(() => {
              const ll = formatLastLogin(u.last_login_at, t);
              return (
                <span title={t('lastLogin')} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '6px', fontWeight: 700, background: ll.color + '18', color: ll.color, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  {ll.recent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ll.color, display: 'inline-block' }} />}
                  🕐 {ll.text}
                </span>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          <button className="action-btn action-btn-edit" title={t('edit')} onClick={() => openModal('editUser', { ...u, newPassword: '' })}>
            <Icon name="edit" size={11} color="var(--primary)" />
          </button>
          <button title={u.is_blocked ? t('unblock') : t('block')} onClick={() => handleBlock(u)}
            style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: u.is_blocked ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)' }}>
            {u.is_blocked ? '🔓' : '🔒'}
          </button>
          <button className="action-btn action-btn-del" title={t('delete')} onClick={() => handleDelete('user', u.id, fullName(u))}>
            <Icon name="trash" size={11} color="var(--red)" />
          </button>
        </div>
      </div>
    );
  };

  const BranchBlock = ({ branch }) => {
    const users = getBranchUsers(branch.id);
    const isOpen = expandedBranch[branch.id];
    if (!matchBranch(branch) && !users.some(matchUser)) return null;
    return (
      <div style={{ marginLeft: '20px', marginBottom: '6px', border: '1px solid #E2E4F0', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Branch header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#F9FAFB', cursor: 'pointer' }}
          onClick={() => setExpandedBranch(p => ({ ...p, [branch.id]: !p[branch.id] }))}>
          <span style={{ color: '#9EA3BF', fontSize: '14px', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : '' }}>▶</span>
          <Icon name="box" size={15} color="#FF6B2B" />
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{branch.name}</span>
          {branch.created_by_name && <CreatorTag name={branch.created_by_name} role={branch.created_by_role} />}
          <span style={{ fontSize: '11px', color: '#9EA3BF' }}>{users.length} {t('persons')}</span>
          <div style={{ display: 'flex', gap: '3px' }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: '11px', background: 'rgba(67,56,202,.08)', border: 'none', color: 'var(--primary)', borderRadius: '6px', cursor: 'pointer' }}
              onClick={() => openModal('user', { company_id: branch.company_id, branch_id: branch.id, role: 'cashier' })}>
              + {t('addUser')}
            </button>
            <button className="action-btn action-btn-edit" onClick={() => openModal('editBranch', { ...branch })}>
              <Icon name="edit" size={11} color="var(--primary)" />
            </button>
            <button className="action-btn action-btn-del" onClick={() => handleDelete('branch', branch.id, branch.name)}>
              <Icon name="trash" size={11} color="var(--red)" />
            </button>
          </div>
        </div>
        {/* Branch users */}
        {isOpen && (
          <div style={{ padding: '8px 10px' }}>
            {users.length === 0 && <div style={{ fontSize: '12px', color: '#9EA3BF', padding: '4px 0', textAlign: 'center' }}>{t('noData')}</div>}
            {users.map(u => <UserRow key={u.id} u={u} />)}
          </div>
        )}
      </div>
    );
  };

  const CompanyBlock = ({ company }) => {
    const branches = getBranches(company.id);
    const directors = getCompanyDirectors(company.id);
    const isOpen = expanded[company.id];
    if (!matchCompany(company) && !branches.some(b => matchBranch(b) || getBranchUsers(b.id).some(matchUser))) return null;
    return (
      <div style={{ marginBottom: '12px', border: '2px solid #E2E4F0', borderRadius: '14px', overflow: 'hidden' }}>
        {/* Company header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'linear-gradient(135deg, rgba(67,56,202,.06), rgba(67,56,202,.02))', cursor: 'pointer' }}
          onClick={() => setExpanded(p => ({ ...p, [company.id]: !p[company.id] }))}>
          <span style={{ color: 'var(--primary)', fontSize: '16px', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : '' }}>▶</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="store" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '16px', color: '#1A1B2E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {company.name}
              {company.created_by_name && <CreatorTag name={company.created_by_name} role="admin" />}
            </div>
            <div style={{ fontSize: '12px', color: '#6B6F8A', marginTop: '1px' }}>
              {branches.length} {t('branchCount')} · {branches.reduce((s, b) => s + getBranchUsers(b.id).length, 0) + directors.length} {t('employees')}
              {(() => {
                const f = getCompanyFounder(company.id);
                return f ? <span style={{ marginLeft: '8px', color: '#7c3aed', fontWeight: 700 }}>{t('founderRole')}: {fullName(f)}</span> : null;
              })()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm" style={{ padding: '5px 10px', fontSize: '11px', background: 'rgba(255,107,43,.1)', border: 'none', color: '#FF6B2B', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
              onClick={() => openModal('branch', { company_id: company.id })}>
              + {t('branches')}
            </button>
            <button className="btn btn-sm" style={{ padding: '5px 10px', fontSize: '11px', background: 'rgba(67,56,202,.1)', border: 'none', color: 'var(--primary)', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
              onClick={() => {
                const hasFounder = !!getCompanyFounder(company.id);
                const hasGenDir = !!getCompanyGenDir(company.id);
                const defaultRole = !hasFounder ? 'founder' : !hasGenDir ? 'gen_dir' : 'manager';
                openModal('user', { company_id: company.id, role: defaultRole });
              }}>
              + {t('addUser')}
            </button>
            <button className="action-btn action-btn-edit" onClick={() => openModal('editCompany', { ...company })}>
              <Icon name="edit" size={12} color="var(--primary)" />
            </button>
            <button className="action-btn action-btn-del" onClick={() => handleDelete('company', company.id, company.name)}>
              <Icon name="trash" size={12} color="var(--red)" />
            </button>
          </div>
        </div>

        {/* Company content */}
        {isOpen && (
          <div style={{ padding: '12px 16px' }}>
            {/* Founder + Gen director — both editable */}
            {(() => {
              const f = getCompanyFounder(company.id);
              const g = getCompanyGenDir(company.id);
              if (!f && !g) return null;
              return (
                <div style={{ marginBottom: '10px' }}>
                  {f && <UserRow key={f.id} u={f} />}
                  {g && <UserRow key={g.id} u={g} />}
                </div>
              );
            })()}
            {/* Branches */}
            {branches.length === 0
              ? <div style={{ fontSize: '13px', color: '#9EA3BF', textAlign: 'center', padding: '12px 0' }}>{t('noBranches')}</div>
              : branches.map(b => <BranchBlock key={b.id} branch={b} />)
            }
          </div>
        )}
      </div>
    );
  };

  // ─── Modal render ─────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!activeModal) return null;

    const isEdit = activeModal.startsWith('edit');
    const m = activeModal.toLowerCase();
    const isUser = m.includes('user');
    const isBranch = m.includes('branch');
    const isCompany = m.includes('company');
    const isPwd = activeModal === 'resetPwd';

    const title = isEdit
      ? (isUser ? `${t('editUserTitle')} — @${modalData.username}` : isCompany ? t('editCompany') : t('editBranch'))
      : isPwd ? t('changePassword')
      : isUser ? t('addUser') : isBranch ? `+ ${t('branches')}` : `+ ${t('companies')}`;

    const onSave = isEdit ? handleEdit : isPwd ? handleResetPwd : handleCreate;
    const companiesForBranch = companies;
    const branchesForUser = allBranches.filter(b => b.company_id === (parseInt(modalData.company_id) || modalData.company_id));

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontWeight: 800, fontSize: '18px' }}>{title}</div>
            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
          </div>
          {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: '14px' }}>{msg.text}</div>}

          {/* Password reset */}
          {isPwd && (
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('newPassword')}</label>
              <input className="input" type="password" value={modalData.newPassword || ''} onChange={e => setModalData({ ...modalData, newPassword: e.target.value })} placeholder={t('minPassword')} autoFocus />
            </div>
          )}

          {/* Company fields */}
          {(isCompany) && (
            <>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('companyName')} *</label><input className="input" value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })} required /></div>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('address')}</label><input className="input" value={modalData.address || ''} onChange={e => setModalData({ ...modalData, address: e.target.value })} /></div>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('phone')}</label><input className="input" value={modalData.phone || ''} onChange={e => setModalData({ ...modalData, phone: e.target.value })} /></div>

              {/* Founder block — only on create */}
              {!isEdit && (
                <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(67,56,202,.04)', borderRadius: '10px', border: '1px dashed rgba(67,56,202,.2)' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    👤 {t('founderInfo')}
                  </div>
                  <div className="form-grid" style={{ marginBottom: '10px' }}>
                    <div>
                      <label className="label">{t('founderFirstName')} *</label>
                      <input className="input" value={modalData.founder_first_name || ''} onChange={e => setModalData({ ...modalData, founder_first_name: e.target.value })} placeholder={t('firstNamePlaceholder')} required />
                    </div>
                    <div>
                      <label className="label">{t('founderLastName')}</label>
                      <input className="input" value={modalData.founder_last_name || ''} onChange={e => setModalData({ ...modalData, founder_last_name: e.target.value })} placeholder={t('lastNamePlaceholder')} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label className="label">{t('founderLogin')} *</label>
                    <input className="input" value={modalData.gen_dir_username || ''} onChange={e => setModalData({ ...modalData, gen_dir_username: e.target.value })} placeholder="login" required />
                  </div>
                  <div>
                    <label className="label">{t('founderPassword')} *</label>
                    <input className="input" type="password" value={modalData.gen_dir_password || ''} onChange={e => setModalData({ ...modalData, gen_dir_password: e.target.value })} placeholder={t('minPassword')} required />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Branch fields */}
          {isBranch && (
            <>
              {!isEdit && (
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">{t('company')}</label>
                  <select className="input" value={modalData.company_id || ''} onChange={e => setModalData({ ...modalData, company_id: parseInt(e.target.value) })}>
                    <option value="">— {t('selectCompany')} —</option>
                    {companiesForBranch.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '12px' }}><label className="label">{t('branchName')}</label><input className="input" value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })} placeholder={t('branchPlaceholder')} required /></div>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('address')}</label><input className="input" value={modalData.address || ''} onChange={e => setModalData({ ...modalData, address: e.target.value })} /></div>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('phone')}</label><input className="input" value={modalData.phone || ''} onChange={e => setModalData({ ...modalData, phone: e.target.value })} /></div>
            </>
          )}

          {/* User fields */}
          {isUser && !isPwd && (
            <>
              <div className="form-grid" style={{ marginBottom: '12px' }}>
                <div><label className="label">{t('firstName')}</label><input className="input" value={modalData.first_name || ''} onChange={e => setModalData({ ...modalData, first_name: e.target.value })} placeholder={t('firstNamePlaceholder')} /></div>
                <div><label className="label">{t('lastName')}</label><input className="input" value={modalData.last_name || ''} onChange={e => setModalData({ ...modalData, last_name: e.target.value })} placeholder={t('lastNamePlaceholder')} /></div>
              </div>
              <div style={{ marginBottom: '12px' }}><label className="label">{t('loginLabel')}</label><input className="input" value={modalData.username || ''} onChange={e => setModalData({ ...modalData, username: e.target.value })} placeholder="username" required={!isEdit} /></div>
              {!isEdit && <div style={{ marginBottom: '12px' }}><label className="label">{t('passwordLabel')}</label><input className="input" type="password" value={modalData.password || ''} onChange={e => setModalData({ ...modalData, password: e.target.value })} placeholder={t('minPassword')} /></div>}
              {(() => {
                // For each company-level role, check if the company already has one (excluding current user)
                const cid = modalData.company_id;
                const existingFounder = cid && getCompanyFounder(cid);
                const existingGenDir  = cid && getCompanyGenDir(cid);
                const blockFounder = existingFounder && existingFounder.id !== modalData.id;
                const blockGenDir  = existingGenDir  && existingGenDir.id  !== modalData.id;
                const roles = ['founder','gen_dir','manager','cashier','warehouse','seller'].filter(r => {
                  if (r === 'founder' && blockFounder) return false;
                  if (r === 'gen_dir' && blockGenDir) return false;
                  return true;
                });
                // Coerce current value to a valid choice
                let currentRole = modalData.role || 'cashier';
                if ((currentRole === 'founder' && blockFounder) || (currentRole === 'gen_dir' && blockGenDir)) currentRole = 'manager';
                return (
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label">{t('role')}</label>
                    <select className="input" value={currentRole} onChange={e => {
                      const newRole = e.target.value;
                      const companyLevel = newRole === 'founder' || newRole === 'gen_dir';
                      setModalData({ ...modalData, role: newRole, branch_id: companyLevel ? null : modalData.branch_id });
                    }}>
                      {roles.map(r => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
                    </select>
                    {(blockFounder || blockGenDir) && (
                      <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '4px' }}>
                        {blockFounder && <div>⚠️ {t('founderRole')}: @{existingFounder.username}</div>}
                        {blockGenDir && <div>⚠️ {t('genDirRole')}: @{existingGenDir.username}</div>}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div style={{ marginBottom: '12px' }}>
                <label className="label">{t('company')}</label>
                <select className="input" value={modalData.company_id || ''} onChange={e => setModalData({ ...modalData, company_id: e.target.value ? parseInt(e.target.value) : null, branch_id: null })}>
                  <option value="">— {t('selectCompany')} —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {modalData.company_id && modalData.role !== 'gen_dir' && modalData.role !== 'founder' && (
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">{t('branch')}</label>
                  <select className="input" value={modalData.branch_id || ''} onChange={e => setModalData({ ...modalData, branch_id: e.target.value ? parseInt(e.target.value) : null })}>
                    <option value="">— {t('selectBranch')} —</option>
                    {branchesForUser.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {isEdit && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: '12px' }}
                  onClick={() => openModal('resetPwd', { id: modalData.id, username: modalData.username, newPassword: '' })}>
                  🔑 {t('changePassword')}
                </button>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-primary" onClick={onSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
            <button className="btn btn-ghost" onClick={closeModal} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-value mono" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={18} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <span style={{ color: 'var(--text3)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchAll')} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9EA3BF', fontSize: '18px' }}>×</button>}
        </div>
        <button className="btn btn-primary" onClick={() => openModal('company')}>
          <Icon name="plus" size={14} color="#fff" /> {t('companies')}
        </button>
        <button className="btn btn-orange" onClick={() => openModal('branch', {})}>
          <Icon name="plus" size={14} color="#fff" /> {t('branches')}
        </button>
        <button className="btn btn-success" onClick={() => openModal('user', { role: 'cashier' })}>
          <Icon name="plus" size={14} color="#fff" /> {t('addEmployee')}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>{t('refresh')}</button>
      </div>

      {msg && !activeModal && (
        <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span>{msg.text}</span>
          <button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button>
        </div>
      )}

      {loading ? (
        <div className="center" style={{ padding: '60px' }}><div className="spinner" /></div>
      ) : (
        <div>
          {/* Companies tree */}
          {companies.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>🏢</div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#1A1B2E', marginBottom: '6px' }}>{t('noCompanies')}</div>
              <button className="btn btn-primary" onClick={() => openModal('company')} style={{ marginTop: '12px' }}>
                + {t('addCompany')}
              </button>
            </div>
          ) : (
            companies.map(c => <CompanyBlock key={c.id} company={c} />)
          )}

          {/* Unassigned users */}
          {unassignedUsers.length > 0 && (
            <div style={{ marginTop: '16px', border: '2px dashed #E2E4F0', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#9EA3BF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="info" size={15} color="#9EA3BF" />
                {t('noCompanyGroup')} ({unassignedUsers.length})
              </div>
              {unassignedUsers.filter(matchUser).map(u => <UserRow key={u.id} u={u} />)}
            </div>
          )}
        </div>
      )}

      {/* Role Change Log */}
      <div style={{ marginTop: '24px', border: '1.5px solid #E2E4F0', borderRadius: '14px', overflow: 'hidden' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: '#F9FAFB', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowLog(v => !v)}
        >
          <span style={{ fontSize: '16px', transition: 'transform .2s', transform: showLog ? 'rotate(90deg)' : '', color: '#9EA3BF' }}>▶</span>
          <Icon name="lock" size={16} color="#6B6F8A" />
          <span style={{ fontWeight: 800, fontSize: '14px', color: '#1A1B2E', flex: 1 }}>
            {t('roleChangeLog')}
          </span>
          <span style={{ fontSize: '12px', color: '#9EA3BF' }}>{roleLog.length} {t('records')}</span>
        </div>
        {showLog && (
          <div style={{ padding: '12px 16px' }}>
            {/* Period filter — role_change_log uses changed_at, so map to created_at for filterByPeriod */}
            <div style={{ marginBottom: '12px' }}>
              <PeriodFilter period={logPeriod} setPeriod={setLogPeriod} customRange={logCustomRange} setCustomRange={setLogCustomRange} showAll compact />
            </div>
            {(() => {
              const items = roleLog.map(r => ({ ...r, created_at: r.changed_at }));
              const filtered = filterByPeriod(items, logPeriod, logCustomRange);
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', color: '#9EA3BF', padding: '20px', fontSize: '13px' }}>{t('noChanges')}</div>;
              }
              return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F4F5FA' }}>
                      {[t('user'), t('oldRole'), t('newRole'), t('changedBy'), t('date')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#6B6F8A', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #F4F5FA' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>@{r.username}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: (roleBadge[r.old_role] === 'badge-blue' ? 'rgba(67,56,202,.1)' : 'rgba(156,163,175,.1)'), color: roleColor[r.old_role] || '#6B6F8A', padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '11px' }}>
                            {t(ROLE_KEYS[r.old_role]) || r.old_role}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: (roleBadge[r.new_role] === 'badge-blue' ? 'rgba(67,56,202,.1)' : 'rgba(34,197,94,.1)'), color: roleColor[r.new_role] || '#16a34a', padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '11px' }}>
                            {t(ROLE_KEYS[r.new_role]) || r.new_role}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <CreatorTag name={r.changed_by_username} role={r.changed_by_username === 'admin' ? 'admin' : 'manager'} />
                        </td>
                        <td style={{ padding: '8px 12px', color: '#9EA3BF', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {new Date(r.changed_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom padding so role log doesn't kiss the viewport edge */}
      <div style={{ height: '40px' }} />

      {renderModal()}
    </div>
  );
}
