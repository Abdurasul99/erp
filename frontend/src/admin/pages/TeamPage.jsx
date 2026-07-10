import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Skeleton, EmptyState, fmtNum } from '../../owner/ui.jsx';

const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

export default function TeamPage() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', password: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    api.get('/admin/team')
      .then(r => setTeam(r.data || []))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(null), 3500); };

  const create = async () => {
    if (!form.username.trim() || !form.password) { flash('Укажи логин и пароль'); return; }
    setSaving(true);
    try {
      await api.post('/admin/team', form);
      setShowCreate(false);
      setForm({ first_name: '', last_name: '', username: '', password: '' });
      flash('✅ Сотрудник создан');
      load();
    } catch (e) { flash('⚠️ ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  const toggleBlock = async (u) => {
    if (!window.confirm(`${u.is_blocked ? 'Разблокировать' : 'Заблокировать'} @${u.username}?`)) return;
    try { await api.put(`/admin/team/${u.id}/block`); load(); }
    catch (e) { flash('⚠️ ' + (e.response?.data?.error || e.message)); }
  };

  const resetPwd = async (u) => {
    const pwd = window.prompt(`Новый пароль для @${u.username} (мин. 4 символа):`);
    if (!pwd) return;
    try { await api.post(`/admin/team/${u.id}/reset-password`, { password: pwd }); flash('🔑 Пароль обновлён'); }
    catch (e) { flash('⚠️ ' + (e.response?.data?.error || e.message)); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Удалить сотрудника @${u.username}? Это необратимо.`)) return;
    try { await api.delete(`/admin/team/${u.id}`); load(); }
    catch (e) { flash('⚠️ ' + (e.response?.data?.error || e.message)); }
  };

  return (
    <>
      <PageHeader
        title="👥 Наша команда — WoW"
        sub="Сотрудники WoW · доступ ко всем компаниям"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowCreate(s => !s)}>➕ Создать сотрудника</button>}
      />

      {msg && <Card style={{ marginBottom: 12 }}><div style={{ fontWeight: 700 }}>{msg}</div></Card>}
      {error && <Card style={{ marginBottom: 12 }}><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>}

      {showCreate && (
        <Card icon="➕" title="Новый сотрудник WoW" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
            <div><label className="label">Имя</label><input className="input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Имя" /></div>
            <div><label className="label">Фамилия</label><input className="input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Фамилия" /></div>
            <div><label className="label">Логин *</label><input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="login" autoComplete="off" /></div>
            <div><label className="label">Пароль *</label><input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="пароль" autoComplete="new-password" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={create}>{saving ? 'Сохранение…' : 'Создать'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Отмена</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Сотрудник получит роль администратора WoW — полный доступ ко всем компаниям (без финансов клиентов).
          </div>
        </Card>
      )}

      {loading ? (
        <div className="card" style={{ padding: 20 }}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} style={{ marginBottom: 8 }} />)}</div>
      ) : team.length === 0 ? (
        <EmptyState icon="👥" title="Команда пуста" description="Создай первого сотрудника WoW кнопкой выше." />
      ) : (
        <Card icon="👥" title={`Сотрудники WoW · ${fmtNum(team.length)}`}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Логин</th>
                  <th>Роль</th>
                  <th style={{ textAlign: 'right' }}>Последний вход</th>
                  <th style={{ textAlign: 'center' }}>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {team.map(u => {
                  const days = u.last_login_at ? Math.floor((Date.now() - new Date(u.last_login_at).getTime()) / 86400000) : null;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{fullName(u).slice(0, 2).toUpperCase()}</div>
                          {fullName(u)}
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 13 }}>@{u.username}</td>
                      <td><Badge tone="orange">Учредитель WoW</Badge></td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                        {days == null ? 'не входил' : days === 0 ? 'сегодня' : `${days} дн назад`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {u.is_blocked ? <Badge tone="red">🔒 заблок.</Badge> : <Badge tone="green">активен</Badge>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => resetPwd(u)} title="Сменить пароль">🔑</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleBlock(u)} title={u.is_blocked ? 'Разблокировать' : 'Заблокировать'}>{u.is_blocked ? '🔓' : '🔒'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(u)} title="Удалить" style={{ color: 'var(--red)' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
