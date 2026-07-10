import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Скрипты продаж» — каталог речевых скриптов + статистика конверсии по применениям.
// Конверсия = доля применений с результатом 'success' среди всех записей script_usage.
// Деньги (атрибутированная выручка по продавцам, использовавшим скрипт) — полным числом, UZS.

const STATUS_TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'active',   label: 'Активные' },
  { value: 'inactive', label: 'Архив' },
];

function trendCell(delta) {
  if (delta == null) return <span style={{ color: 'var(--text3)' }}>—</span>;
  const up = delta > 0, flat = delta === 0;
  const color = flat ? 'var(--text3)' : up ? '#16A34A' : '#DC2626';
  const arrow = flat ? '0%' : (up ? '▲' : '▼');
  return (
    <span style={{ color, fontWeight: 800, fontSize: 12 }}>
      {flat ? '0%' : `${arrow} ${up ? '+' : '−'}${Math.abs(delta)}%`}
    </span>
  );
}

export default function SalesScriptsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/sales/scripts', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const scripts = data?.scripts || [];
  const stats = data?.stats || {};

  const filtered = scripts.filter(s => {
    if (tab === 'active') return s.active;
    if (tab === 'inactive') return !s.active;
    return true;
  });

  return (
    <>
      <PageHeader
        title={tt('📞 Скрипты продаж')}
        sub={tt('Речевые модули · ситуации · конверсия по применениям')}
        actions={<Badge tone="amber">{tt('В обработке')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile
              icon="📋"
              label={tt('Активных скриптов')}
              value={fmtNum(stats.active_scripts || 0)}
              sub={tt('в работе')}
              color="#1D4ED8"
            />
            <Tile
              icon="🎯"
              label={tt('Средняя конверсия')}
              value={`${stats.avg_conversion || 0}%`}
              delta={stats.conversion_delta}
              sub={tt('по всем применениям')}
              color="#16A34A"
            />
            <Tile
              icon="🏆"
              label={tt('Лучший скрипт')}
              value={stats.best_script ? `${stats.best_conversion || 0}%` : '—'}
              sub={stats.best_script ? tt(stats.best_script) : tt('нет данных')}
              color="#D97706"
            />
            <Tile
              icon="💰"
              label={tt('Выручка с применений')}
              value={fmtMoneyFull(stats.attributed_revenue || 0)}
              sub={tt('UZS · 30 дней')}
              color="#0EA5E9"
            />
          </div>

          <Card
            icon="📞"
            title={`${tt('Все скрипты')} (${filtered.length})`}
            actions={<Pills value={tab} onChange={setTab} options={STATUS_TABS.map(t => ({ ...t, label: tt(t.label) }))} />}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>{tt('Скрипт')}</th>
                    <th>{tt('Ситуация')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Использований')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Конверсия')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Тренд')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет скриптов')}</td></tr>
                  ) : filtered.map(s => {
                    const conv = s.conversion || 0;
                    const convColor = conv >= 60 ? '#16A34A' : conv >= 45 ? '#D97706' : '#DC2626';
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.title}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{s.situation || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.usage_count || 0)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: convColor }}>{conv}%</td>
                        <td style={{ textAlign: 'center' }}>{trendCell(s.trend)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {s.active
                            ? <Badge tone="green">{tt('Активен')}</Badge>
                            : <Badge tone="gray">{tt('Архив')}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🛠️" title={tt('Скоро')} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
              {tt('Планируется ИИ для анализа аудиозаписей разговоров и автогенерации скриптов продаж под ситуацию.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
