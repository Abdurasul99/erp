import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { AuthContext } from '../../App.jsx';
import { Tile, Card, Badge, PageHeader, Skeleton, EmptyState, fmtMoney, fmtNum } from '../../owner/ui.jsx';

const ROLE_LABEL = {
  admin:     'Администратор',
  founder:   'Учредитель',
  gen_dir:   'Директор сети',
  manager:   'Менеджер',
  cashier:   'Кассир',
  warehouse: 'Складовщик',
  seller:    'Продавец',
};

const ROLE_TONE = {
  admin: 'red', founder: 'orange', gen_dir: 'purple', manager: 'blue',
  cashier: 'green', warehouse: 'cyan', seller: 'yellow',
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get(`/admin/companies/${id}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const { impersonate } = useContext(AuthContext);
  const [impRole, setImpRole] = useState('founder');
  const [impBranch, setImpBranch] = useState('');
  const [impBusy, setImpBusy] = useState(false);

  const company = data?.company;
  const branches = data?.branches || [];
  const users = data?.users || [];
  const usage = data?.usage || {};

  const isCoLevel = impRole === 'founder' || impRole === 'gen_dir';
  const enterCompany = async () => {
    if (!isCoLevel && !impBranch) { window.alert('Выберите филиал для этой роли'); return; }
    setImpBusy(true);
    try {
      const { data: r } = await api.post('/admin/impersonate', {
        company_id: company.id, role: impRole, branch_id: isCoLevel ? null : (impBranch || null),
      });
      impersonate(r.user, r.token);
      const role = r.user.role;
      if (role === 'seller') {
        localStorage.setItem('seller_branch_id', String(r.user.branch_id));
        localStorage.setItem('seller_branch_name', r.user.branch_name || '');
        const d = new Date();
        localStorage.setItem('seller_branch_picked_date', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        navigate('/sell');
      } else if (['founder', 'gen_dir', 'manager'].includes(role)) {
        navigate('/owner');
      } else {
        navigate('/desktop');
      }
    } catch (e) {
      window.alert(e.response?.data?.error || e.message);
    } finally {
      setImpBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={() => navigate('/admin')} className="btn btn-ghost btn-sm">← Назад к списку</button>
      </div>

      {loading && !data ? (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <Skeleton height={28} style={{ width: '40%', marginBottom: 12 }} />
            <Skeleton height={14} style={{ width: '60%' }} />
          </div>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <Skeleton height={12} style={{ width: '50%', marginBottom: 10 }} />
                <Skeleton height={26} style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        </>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>
      ) : !company ? (
        <EmptyState icon="🔍" title="Компания не найдена" description="Возможно, она была удалена или ID указан неверно." />
      ) : (
        <>
          <PageHeader
            title={`🏢 ${company.name}`}
            sub={`ID #${company.id} · создана ${new Date(company.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          />

          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏭" label="Филиалов"      value={fmtNum(usage.branches_count)} sub="в компании"   color="#5B4FE8" />
            <Tile icon="👥" label="Сотрудников"   value={fmtNum(usage.users_count)}    sub="всего"        color="#0EA5E9" />
            <Tile icon="✅" label="Активных"      value={fmtNum(usage.active_users)}   sub="не заблок."    color="#22C55E" />
            <Tile icon="🔒" label="Заблокировано" value={fmtNum(usage.blocked_users)}  sub="юзеров"        color="#EF4444" />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="🏭" title={`Филиалы · ${branches.length}`}>
              {branches.length === 0 ? (
                <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>Филиалов нет</div>
              ) : (
                <div className="list">
                  {branches.map(b => (
                    <div key={b.id} className="list-item">
                      <span style={{ fontSize: 18 }}>🏭</span>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{b.name}</div>
                        <div className="list-item-sub">ID #{b.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card icon="👥" title={`Пользователи · ${users.length}`}>
              {users.length === 0 ? (
                <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>Юзеров нет</div>
              ) : (
                <div className="list">
                  {users.slice(0, 8).map(u => {
                    const days = u.last_login_at ? Math.floor((Date.now() - new Date(u.last_login_at).getTime()) / 86400000) : null;
                    return (
                      <div key={u.id} className="list-item">
                        <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {(u.first_name || u.username).slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="list-item-title">
                            {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                            {u.is_blocked && <Badge tone="red">🔒 заблокирован</Badge>}
                          </div>
                          <div className="list-item-sub">@{u.username}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Badge tone={ROLE_TONE[u.role] || 'gray'}>{ROLE_LABEL[u.role] || u.role}</Badge>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                            {days == null ? 'не заходил' : days === 0 ? 'сегодня' : `${days} дн назад`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {users.length > 8 && (
                    <div style={{ padding: 8, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                      ...и ещё {users.length - 8}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <Card icon="🔑" title="Войти в компанию (как сотрудник)" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 180 }}>
                <label className="label">Роль</label>
                <select className="input" value={impRole} onChange={e => setImpRole(e.target.value)}>
                  <option value="founder">Учредитель</option>
                  <option value="gen_dir">Директор сети</option>
                  <option value="manager">Менеджер</option>
                  <option value="cashier">Кассир</option>
                  <option value="warehouse">Складовщик</option>
                  <option value="seller">Продавец</option>
                </select>
              </div>
              <div style={{ minWidth: 200 }}>
                <label className="label">Филиал{isCoLevel ? ' (все)' : ' *'}</label>
                <select className="input" value={impBranch} onChange={e => setImpBranch(e.target.value)} disabled={isCoLevel}>
                  <option value="">{isCoLevel ? 'Все филиалы' : '— выберите —'}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" disabled={impBusy} onClick={enterCompany}>{impBusy ? 'Вход…' : 'Войти →'}</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              Вы войдёте в «{company.name}» как выбранная роль и увидите все её окна и данные. Вернуться — по плашке внизу экрана.
            </div>
          </Card>

          <Card icon="🚦" title="Быстрые действия">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/features')}>
                🚦 Настроить фичи компании
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/audit')}>
                📋 Audit log компании
              </button>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
