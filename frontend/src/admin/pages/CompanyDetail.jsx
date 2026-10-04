import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { AuthContext } from '../../App.jsx';
import { Tile, Card, Badge, PageHeader, Skeleton, EmptyState, fmtMoney, fmtNum } from '../../owner/ui.jsx';
import CompanyAccessControl from '../CompanyAccessControl.jsx';
import { ROLE_LABELS as EVENTS_ROLE_LABELS } from '../../events/access.js';

// «Войти как» — роли зависят от продукта компании. В «Мероприятия» только
// управленческие: у админа нет своей бригады, и вход исполнителем показал бы
// пустоту. Сервер (products.IMPERSONATABLE_ROLES) проверяет то же самое.
const IMP_ROLES = {
  wave: ['founder', 'director', 'manager', 'cashier', 'warehouse', 'seller'],
  events: ['founder', 'project_manager', 'coordinator'],
};

const ROLE_LABEL = {
  admin:     'Администратор',
  founder:   'Учредитель',
  director:   'Директор',
  manager:   'Менеджер',
  cashier:   'Кассир',
  warehouse: 'Складовщик',
  seller:    'Продавец',
};

const ROLE_TONE = {
  admin: 'red', founder: 'orange', director: 'purple', manager: 'blue',
  cashier: 'green', warehouse: 'cyan', seller: 'yellow',
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

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

  const product = company?.product === 'events' ? 'events' : 'wave';
  const impRoles = IMP_ROLES[product];
  // Роль, которую форма показывает и отправляет, — всегда из списка продукта:
  // иначе после выбора «кассира» в соседней компании Wave на сервер ушла бы роль,
  // которой в «Мероприятиях» нет.
  const effectiveRole = impRoles.includes(impRole) ? impRole : 'founder';
  // Филиал: в Wave учредитель и директор работают без него, остальным обязателен.
  // В «Мероприятиях» учредитель и руководитель проектов — без филиала, а
  // координатор может быть и с филиалом, и без (тогда видит всю компанию).
  const branchLocked = product === 'events'
    ? (effectiveRole === 'founder' || effectiveRole === 'project_manager')
    : (effectiveRole === 'founder' || effectiveRole === 'director');
  const branchRequired = product === 'wave' && !branchLocked;
  const isCoLevel = branchLocked;
  const setCompanyEnabled = async (enabled) => {
    if (!enabled && !window.confirm(
      `Отключить «${company.name}»? Все текущие сессии завершатся, и пользователи не смогут войти.`
    )) return;

    setStatusBusy(true);
    try {
      const { data: result } = await api.put(`/companies/${company.id}/status`, { enabled });
      setData(current => ({
        ...current,
        company: { ...current.company, is_enabled: result.is_enabled },
      }));
    } catch (e) {
      window.alert(e.response?.data?.error || e.message);
    } finally {
      setStatusBusy(false);
    }
  };

  const enterCompany = async () => {
    if (branchRequired && !impBranch) { window.alert('Выберите филиал для этой роли'); return; }
    setImpBusy(true);
    try {
      const { data: r } = await api.post('/admin/impersonate', {
        company_id: company.id, role: effectiveRole, branch_id: branchLocked ? null : (impBranch || null),
      });
      impersonate(r.user, r.token);
      const role = r.user.role;
      // Продукт — раньше роли: учредитель есть в обоих продуктах.
      if (r.user.product === 'events') {
        navigate('/events');
      } else if (role === 'seller') {
        localStorage.setItem('seller_branch_id', String(r.user.branch_id));
        localStorage.setItem('seller_branch_name', r.user.branch_name || '');
        const d = new Date();
        localStorage.setItem('seller_branch_picked_date', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        navigate('/sell');
      } else if (['founder', 'director', 'manager'].includes(role)) {
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

          <Card icon="🔐" title="Доступ компании" style={{ marginBottom: 16 }}>
            <CompanyAccessControl
              enabled={company.is_enabled !== false}
              busy={statusBusy}
              onToggle={setCompanyEnabled}
            />
          </Card>

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
                          <Badge tone={ROLE_TONE[u.role] || 'gray'}>{ROLE_LABEL[u.role] || EVENTS_ROLE_LABELS[u.role] || u.role}</Badge>
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
                <select className="input" value={effectiveRole} onChange={e => setImpRole(e.target.value)}>
                  {impRoles.map(r => <option key={r} value={r}>{ROLE_LABEL[r] || EVENTS_ROLE_LABELS[r] || r}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 200 }}>
                <label className="label">Филиал{branchLocked ? ' (все)' : (branchRequired ? ' *' : '')}</label>
                <select className="input" value={branchLocked ? '' : impBranch} onChange={e => setImpBranch(e.target.value)} disabled={branchLocked}>
                  <option value="">{branchLocked || !branchRequired ? 'Все филиалы' : '— выберите —'}</option>
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
