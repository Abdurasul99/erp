import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, fmtNum } from '../ui.jsx';

// Матрица Роли × Права — это РЕАЛЬНЫЕ правила доступа, зашитые в backend
// (auth() middleware в server.js). Это не настройка, а документация системы.
const ROLE_MATRIX = [
  { role: 'Admin (SaaS)',   catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Учредитель',     catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Ген. директор',  catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Менеджер',       catalog: 'RW', sales: 'RW', finance: 'R · свой филиал', hr: 'R', settings: '—', ai: '—' },
  { role: 'Кассир',         catalog: 'R',  sales: 'RW', finance: 'R · касса', hr: '—', settings: '—', ai: '—' },
  { role: 'Складовщик',     catalog: 'RW', sales: 'R · подтверждение', finance: '—', hr: '—', settings: '—', ai: '—' },
  { role: 'Продавец',       catalog: 'R',  sales: 'RW · только свои', finance: '—', hr: '—', settings: '—', ai: '—' },
];

const ROLE_RU = {
  admin: 'Админ', founder: 'Учредитель', gen_dir: 'Ген. директор',
  manager: 'Менеджер', cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};

export default function SecurityTool() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    api.get('/settings/overview')
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const byRole = data?.users_by_role || {};

  return (
    <>
      <PageHeader title="🔐 Безопасность" sub="Роли · права · доступы · реальные данные" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="👥" label="Пользователей" value={fmtNum(data.users_total)} sub="в компании" color="#5B4FE8" />
            <Tile icon="🔄" label="Смен ролей" value={fmtNum(data.role_changes_30d)} sub="за 30 дней" color={data.role_changes_30d > 0 ? '#F59E0B' : '#22C55E'} />
            <Tile icon="🤖" label="AI-запросов" value={fmtNum(data.ai_requests_30d)} sub="за 30 дней" color="#0EA5E9" />
            <Tile icon="🏭" label="Филиалов" value={fmtNum((data.branches || []).length)} sub="активных" color="#FF6B2B" />
          </div>

          <Card icon="👥" title="Команда по ролям" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(byRole).map(([role, c]) => (
                <div key={role} style={{ padding: '10px 16px', background: 'var(--bg-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{ROLE_RU[role] || role}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 900 }}>{c}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon="👮" title="Роли × Права (правила системы)" style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Роль</th><th>Каталог</th><th>Продажи</th><th>Финансы</th><th>HR</th><th>Настройки</th><th>AI</th></tr>
                </thead>
                <tbody>
                  {ROLE_MATRIX.map(r => (
                    <tr key={r.role}>
                      <td style={{ fontWeight: 700 }}>{r.role}</td>
                      {['catalog', 'sales', 'finance', 'hr', 'settings', 'ai'].map(k => (
                        <td key={k}>
                          {r[k] === '—'
                            ? <span style={{ color: 'var(--text3)' }}>—</span>
                            : <Badge tone={String(r[k]).startsWith('RW') ? 'green' : String(r[k]) === '✓' ? 'purple' : 'blue'}>{r[k]}</Badge>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10 }}>
              Эти правила применяются сервером на каждом запросе (auth-middleware) — обойти их из браузера нельзя.
            </div>
          </Card>

          <Card icon="🛡" title="Как защищена система">
            <div className="list">
              {[
                ['🔑', 'Пароли', 'Хранятся как bcrypt-хеши — исходный пароль восстановить нельзя'],
                ['🎫', 'Сессии', 'JWT-токены с автоистечением через 24 часа'],
                ['🏢', 'Изоляция компаний', 'Каждый запрос фильтруется по вашей компании — чужие данные недоступны'],
                ['🏭', 'Изоляция филиалов', 'Менеджер видит только свой филиал — проверяется на сервере'],
                ['📋', 'Журнал', 'Смены ролей и AI-запросы логируются'],
                ['🤖', 'AI-доступ', 'Только учредитель и ген. директор — менеджерам и кассирам закрыт'],
              ].map(([icon, title, sub]) => (
                <div key={title} className="list-item">
                  <div style={{ fontSize: 18 }} aria-hidden="true">{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="list-item-title">{title}</div>
                    <div className="list-item-sub">{sub}</div>
                  </div>
                  <Badge tone="green">✓</Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
