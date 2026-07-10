import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useMsg } from '../utils.js';
import { Icon } from '../icons.jsx';

export default function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [editBranch, setEditBranch] = useState(null);
  const [msg, setMsg, clearMsg] = useMsg();

  const [companyForm, setCompanyForm] = useState({ name: '', address: '', phone: '', director_username: '', director_password: '' });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '', manager_username: '', manager_password: '' });

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => { if (selectedCompany) loadBranches(selectedCompany.id); }, [selectedCompany]);

  const loadCompanies = async () => {
    const { data } = await api.get('/companies');
    setCompanies(data);
  };

  const loadBranches = async (companyId) => {
    const { data } = await api.get(`/branches?company_id=${companyId}`);
    setBranches(data);
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    try {
      await api.post('/companies', companyForm);
      setMsg('success', `Компания "${companyForm.name}" создана`);
      setCompanyForm({ name: '', address: '', phone: '', director_username: '', director_password: '' });
      setShowAddCompany(false);
      loadCompanies();
    } catch (e) { setMsg('error', e.response?.data?.error || 'Ошибка'); }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await api.post('/branches', { ...branchForm, company_id: selectedCompany?.id });
      setMsg('success', `Филиал "${branchForm.name}" создан`);
      setBranchForm({ name: '', address: '', phone: '', manager_username: '', manager_password: '' });
      setShowAddBranch(false);
      if (selectedCompany) loadBranches(selectedCompany.id);
    } catch (e) { setMsg('error', e.response?.data?.error || 'Ошибка'); }
  };

  const deleteCompany = async (id) => {
    if (!window.confirm('Удалить компанию и все её данные?')) return;
    await api.delete(`/companies/${id}`);
    loadCompanies();
    setSelectedCompany(null);
  };

  const deleteBranch = async (id) => {
    if (!window.confirm('Удалить филиал?')) return;
    await api.delete(`/branches/${id}`);
    if (selectedCompany) loadBranches(selectedCompany.id);
  };

  const handleEditCompany = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/companies/${editCompany.id}`, editCompany);
      setMsg('success', 'Компания обновлена');
      setEditCompany(null);
      loadCompanies();
    } catch (e) { setMsg('error', e.response?.data?.error || 'Ошибка'); }
  };

  const handleEditBranch = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/branches/${editBranch.id}`, editBranch);
      setMsg('success', 'Филиал обновлён');
      setEditBranch(null);
      if (selectedCompany) loadBranches(selectedCompany.id);
    } catch (e) { setMsg('error', e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div>
      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span>{msg.text}</span>
          <button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedCompany ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Companies list */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Icon name="store" size={18} color="var(--primary)" /> Компании
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCompany(true)}>+ Добавить</button>
          </div>

          {companies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>
              Нет компаний. Создайте первую.
            </div>
          )}

          {companies.map(c => (
            <div key={c.id} onClick={() => setSelectedCompany(c)} style={{
              padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px',
              border: `2px solid ${selectedCompany?.id === c.id ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedCompany?.id === c.id ? 'rgba(67,56,202,.04)' : '#fff',
              transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>{c.name}</div>
                  {c.address && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{c.address}</div>}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.branch_count}</span> филиал(ов)
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      <span style={{ fontWeight: 700 }}>{c.user_count}</span> сотрудников
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="action-btn action-btn-edit" onClick={(e) => { e.stopPropagation(); setEditCompany({ ...c }); }}>
                    <Icon name="edit" size={12} color="var(--primary)" />
                  </button>
                  <button className="action-btn action-btn-del" onClick={(e) => { e.stopPropagation(); deleteCompany(c.id); }}>
                    <Icon name="trash" size={12} color="var(--red)" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Branches of selected company */}
        {selectedCompany && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="section-title" style={{ marginBottom: 0 }}>Филиалы</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{selectedCompany.name}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddBranch(true)}>+ Добавить</button>
            </div>

            {branches.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>Нет филиалов</div>
            )}

            {branches.map(b => (
              <div key={b.id} style={{
                padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)',
                marginBottom: '8px', background: '#fafafa',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{b.name}</div>
                    {b.address && <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{b.address}</div>}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      {b.manager_name && (
                        <span style={{ fontSize: '11px', background: 'rgba(34,197,94,.1)', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                          Менеджер: {b.manager_name}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{b.user_count} сотр.</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="action-btn action-btn-edit" onClick={() => setEditBranch({ ...b })}>
                      <Icon name="edit" size={12} color="var(--primary)" />
                    </button>
                    <button className="action-btn action-btn-del" onClick={() => deleteBranch(b.id)}>
                      <Icon name="trash" size={12} color="var(--red)" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddCompany && (
        <Modal title="Создать компанию" onClose={() => setShowAddCompany(false)}>
          <form onSubmit={handleAddCompany}>
            <Field label="Название компании">
              <input className="input" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} required />
            </Field>
            <Field label="Адрес">
              <input className="input" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} />
            </Field>
            <Field label="Телефон">
              <input className="input" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} />
            </Field>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', marginBottom: '12px' }}>Директор (опционально)</div>
              <div className="form-grid">
                <Field label="Логин">
                  <input className="input" value={companyForm.director_username} onChange={e => setCompanyForm({ ...companyForm, director_username: e.target.value })} placeholder="username" />
                </Field>
                <Field label="Пароль">
                  <input className="input" type="password" value={companyForm.director_password} onChange={e => setCompanyForm({ ...companyForm, director_password: e.target.value })} placeholder="password" />
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Создать</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddCompany(false)} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Branch Modal */}
      {showAddBranch && (
        <Modal title={`Новый филиал — ${selectedCompany?.name}`} onClose={() => setShowAddBranch(false)}>
          <form onSubmit={handleAddBranch}>
            <Field label="Название филиала">
              <input className="input" value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} required placeholder="Напр: Центральный офис" />
            </Field>
            <Field label="Адрес">
              <input className="input" value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} />
            </Field>
            <Field label="Телефон">
              <input className="input" value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} />
            </Field>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', marginBottom: '12px' }}>Менеджер филиала (опционально)</div>
              <div className="form-grid">
                <Field label="Логин">
                  <input className="input" value={branchForm.manager_username} onChange={e => setBranchForm({ ...branchForm, manager_username: e.target.value })} placeholder="username" />
                </Field>
                <Field label="Пароль">
                  <input className="input" type="password" value={branchForm.manager_password} onChange={e => setBranchForm({ ...branchForm, manager_password: e.target.value })} placeholder="password" />
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Создать</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddBranch(false)} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Company Modal */}
      {editCompany && (
        <Modal title="Редактировать компанию" onClose={() => setEditCompany(null)}>
          <form onSubmit={handleEditCompany}>
            <Field label="Название"><input className="input" value={editCompany.name} onChange={e => setEditCompany({ ...editCompany, name: e.target.value })} required /></Field>
            <Field label="Адрес"><input className="input" value={editCompany.address || ''} onChange={e => setEditCompany({ ...editCompany, address: e.target.value })} /></Field>
            <Field label="Телефон"><input className="input" value={editCompany.phone || ''} onChange={e => setEditCompany({ ...editCompany, phone: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Сохранить</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditCompany(null)} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Branch Modal */}
      {editBranch && (
        <Modal title="Редактировать филиал" onClose={() => setEditBranch(null)}>
          <form onSubmit={handleEditBranch}>
            <Field label="Название"><input className="input" value={editBranch.name} onChange={e => setEditBranch({ ...editBranch, name: e.target.value })} required /></Field>
            <Field label="Адрес"><input className="input" value={editBranch.address || ''} onChange={e => setEditBranch({ ...editBranch, address: e.target.value })} /></Field>
            <Field label="Телефон"><input className="input" value={editBranch.phone || ''} onChange={e => setEditBranch({ ...editBranch, phone: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Сохранить</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditBranch(null)} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 800, fontSize: '18px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text3)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
