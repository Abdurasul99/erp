import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { Tile, Card, Badge, PageHeader, Skeleton, EmptyState, fmtMoney, fmtNum } from '../../owner/ui.jsx';

const ROLE_LABEL = {
  admin:     'Администратор',
  founder:   'Учредитель',
  gen_dir:   'Ген. директор',
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

  const company = data?.company;
  const branches = data?.branches || [];
  const users = data?.users || [];
  const kpi = data?.kpi || {};

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
            <Tile icon="💰" label="Выручка"     value={fmtMoney(kpi.sales_revenue)} sub="UZS"      color="#22C55E" />
            <Tile icon="📦" label="Сделок"     value={fmtNum(kpi.deals_count)}     sub="всего"     color="#5B4FE8" />
            <Tile icon="🏦" label="Касса"       value={fmtMoney(kpi.cash_balance)}  sub="UZS"      color="#0EA5E9" />
            <Tile icon="🏭" label="Склад"       value={fmtMoney(kpi.stock_value)}   sub="оценка"    color="#FF6B2B" />
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
