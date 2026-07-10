import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';

// Матрица Роли × Права — это РЕАЛЬНЫЕ правила доступа, зашитые в backend
// (auth() middleware в server.js). Это не настройка, а документация системы.
const ROLE_MATRIX = [
  { role: 'Admin (SaaS)',   catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Учредитель',     catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Директор',  catalog: 'RW', sales: 'RW', finance: 'RW', hr: 'RW', settings: 'RW', ai: '✓' },
  { role: 'Менеджер',       catalog: 'RW', sales: 'RW', finance: 'R · свой филиал', hr: 'R', settings: '—', ai: '—' },
  { role: 'Кассир',         catalog: 'R',  sales: 'RW', finance: 'R · касса', hr: '—', settings: '—', ai: '—' },
  { role: 'Складовщик',     catalog: 'RW', sales: 'R · подтверждение', finance: '—', hr: '—', settings: '—', ai: '—' },
  { role: 'Продавец',       catalog: 'R',  sales: 'RW · только свои', finance: '—', hr: '—', settings: '—', ai: '—' },
];

const ROLE_RU = {
  admin: 'Админ', founder: 'Учредитель', director: 'Директор',
  manager: 'Менеджер', cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};

export default function SecurityTool() {
  const { tt } = useTt();
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
      <PageHeader title={tt('🔐 Безопасность')} sub={tt('Роли · права · доступы · реальные данные')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="👥" label={tt('Пользователей')} value={fmtNum(data.users_total)} sub={tt('в компании')} color="#1D4ED8" />
            <Tile icon="🔄" label={tt('Смен ролей')} value={fmtNum(data.role_changes_30d)} sub={tt('за 30 дней')} color={data.role_changes_30d > 0 ? '#D97706' : '#16A34A'} />
            <Tile icon="🤖" label={tt('AI-запросов')} value={fmtNum(data.ai_requests_30d)} sub={tt('за 30 дней')} color="#0EA5E9" />
            <Tile icon="🏭" label={tt('Филиалов')} value={fmtNum((data.branches || []).length)} sub={tt('активных')} color="#D97706" />
          </div>

          <Card icon="👥" title={tt('Команда по ролям')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(byRole).map(([role, c]) => (
                <div key={role} style={{ padding: '10px 16px', background: 'var(--bg-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{tt(ROLE_RU[role] || role)}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 900 }}>{c}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon="👮" title={tt('Роли × Права (правила системы)')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>{tt('Роль')}</th><th>{tt('Каталог')}</th><th>{tt('Продажи')}</th><th>{tt('Финансы')}</th><th>{tt('HR')}</th><th>{tt('Настройки')}</th><th>{tt('AI')}</th></tr>
                </thead>
                <tbody>
                  {ROLE_MATRIX.map(r => (
                    <tr key={r.role}>
                      <td style={{ fontWeight: 700 }}>{tt(r.role)}</td>
                      {['catalog', 'sales', 'finance', 'hr', 'settings', 'ai'].map(k => (
                        <td key={k}>
                          {r[k] === '—'
                            ? <span style={{ color: 'var(--text3)' }}>—</span>
                            : <Badge tone={String(r[k]).startsWith('RW') ? 'green' : String(r[k]) === '✓' ? 'purple' : 'blue'}>{tt(r[k])}</Badge>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10 }}>
              {tt('Эти правила применяются сервером на каждом запросе (auth-middleware) — обойти их из браузера нельзя.')}
            </div>
          </Card>

          <Card icon="🛡" title={tt('Как защищена система')}>
            <div className="list">
              {[
                ['🔑', tt('Пароли'), tt('Хранятся как bcrypt-хеши — исходный пароль восстановить нельзя')],
                ['🎫', tt('Сессии'), tt('JWT-токены с автоистечением через 24 часа')],
                ['🏢', tt('Изоляция компаний'), tt('Каждый запрос фильтруется по вашей компании — чужие данные недоступны')],
                ['🏭', tt('Изоляция филиалов'), tt('Менеджер видит только свой филиал — проверяется на сервере')],
                ['📋', tt('Журнал'), tt('Смены ролей и AI-запросы логируются')],
                ['🤖', tt('AI-доступ'), tt('Только учредитель и ген. директор — менеджерам и кассирам закрыт')],
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
