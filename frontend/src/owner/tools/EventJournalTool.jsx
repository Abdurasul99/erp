import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, EmptyState, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const MODULE_META = {
  all:      { label: 'Все модули', icon: '📂', badge: 'gray'   },
  pos:      { label: 'Касса',      icon: '🛒', badge: 'green'  },
  inventory:{ label: 'Склад',      icon: '📦', badge: 'blue'   },
  finance:  { label: 'Финансы',    icon: '💰', badge: 'green'  },
  hr:       { label: 'Персонал',   icon: '👤', badge: 'purple' },
  crm:      { label: 'Клиенты',    icon: '👥', badge: 'blue'   },
  purchase: { label: 'Закупки',    icon: '🏭', badge: 'yellow' },
  settings: { label: 'Настройки',  icon: '⚙️', badge: 'gray'   },
};

const MODULE_TABS = ['all', 'pos', 'inventory', 'finance', 'hr', 'crm', 'purchase', 'settings'];

function modMeta(m) { return MODULE_META[m] || { label: m || '—', icon: '•', badge: 'gray' }; }

function fmtDateTime(v) {
  const d = new Date(v);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SuspiciousRow({ r, tt }) {
  const mm = modMeta(r.module);
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: '#DC2626' }} />
      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#DC262618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🚩</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="list-item-title">{r.user_name || '—'}</div>
          <Badge tone={mm.badge}>{mm.icon} {tt(mm.label)}</Badge>
          {r.branch_name && <Badge tone="gray">{r.branch_name}</Badge>}
        </div>
        <div className="list-item-sub" style={{ marginTop: 3 }}>{r.description}</div>
        <div style={{ marginTop: 5, fontSize: 12, color: '#DC2626', fontWeight: 700 }}>⚠️ {r.suspicious_reason || tt('Подозрительное действие')}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</div>
    </div>
  );
}

export default function EventJournalTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [suspData, setSuspData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [module, setModule] = useState('all');
  const [onlySuspicious, setOnlySuspicious] = useState(false);

  function load() {
    setLoading(true); setError(null);
    const params = { period, module, limit: 200 };
    if (branchId) params.branch_id = branchId;
    if (onlySuspicious) params.suspicious = 'true';

    const suspParams = { period };
    if (branchId) suspParams.branch_id = branchId;

    Promise.all([
      api.get('/audit-log/journal', { params }),
      api.get('/audit-log/suspicious', { params: suspParams }),
    ])
      .then(([j, s]) => { setData(j.data); setSuspData(s.data); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [branchId, period, module, onlySuspicious]);

  const summary = data?.summary || {};
  const items = data?.items || [];
  const suspItems = suspData?.items || [];

  return (
    <>
      <PageHeader
        title={tt('📜 Журнал событий')}
        sub={tt('Иммутабельный лог всех действий в системе · нельзя удалить или изменить')}
        actions={<Badge tone={summary.suspicious > 0 ? 'red' : 'green'}>
          {summary.suspicious > 0 ? `${summary.suspicious} ${tt('подозрительных')}` : tt('Чисто')}
        </Badge>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📋" label={tt('Событий')}          value={fmtNum(summary.total_events)} sub={tt('за период')}        color="#1D4ED8" />
            <Tile icon="👤" label={tt('Уникальных юзеров')} value={fmtNum(summary.unique_users)} sub={tt('активных')}         color="#16A34A" />
            <Tile icon="🚩" label={tt('Подозрительных')}    value={fmtNum(summary.suspicious)}   sub={tt('требуют внимания')} color="#DC2626" />
            <Tile icon="🏆" label={tt('Самый активный')}    value={summary.top_user?.name || '—'} sub={summary.top_user ? `${summary.top_user.count} ${tt('действий')}` : '—'} color="#D97706" />
          </div>

          {suspItems.length > 0 && (
            <Card icon="🚩" title={`${tt('Подозрительные действия')} (${suspItems.length})`} style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,.35)' }}>
              <div className="list">
                {suspItems.slice(0, 20).map(r => <SuspiciousRow key={r.id} r={r} tt={tt} />)}
              </div>
            </Card>
          )}

          <Card icon="📜" title={`${tt('Журнал')} (${items.length})`}
            actions={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pills value={module} onChange={setModule}
                  options={MODULE_TABS.map(m => ({ value: m, label: `${modMeta(m).icon} ${tt(modMeta(m).label)}` }))} />
                <button
                  className={'btn btn-sm ' + (onlySuspicious ? '' : 'btn-ghost')}
                  onClick={() => setOnlySuspicious(v => !v)}
                  style={onlySuspicious ? { background: '#DC2626', color: '#fff', borderColor: '#DC2626' } : {}}>
                  🚩 {tt('Только подозрительные')}
                </button>
              </div>
            }>
            {items.length === 0 ? (
              <EmptyState icon="📭" title={tt('Событий нет')}
                description={tt('За выбранный период по этим фильтрам действий не зафиксировано.')} />
            ) : (
              <div className="ej-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>
                      <th style={{ padding: '8px 10px' }}>{tt('Дата/время')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Пользователь')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Роль')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Модуль')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Действие')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Детали')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(r => {
                      const mm = modMeta(r.module);
                      return (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--border)', background: r.is_suspicious ? 'rgba(239,68,68,.05)' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtDateTime(r.created_at)}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {r.is_suspicious && <span title={r.suspicious_reason || ''}>🚩 </span>}
                            {r.user_name || '—'}
                            {r.branch_name && <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>{r.branch_name}</div>}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{r.user_role || '—'}</td>
                          <td style={{ padding: '8px 10px' }}><Badge tone={mm.badge}>{mm.icon} {tt(mm.label)}</Badge></td>
                          <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{r.action || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>
                            {r.description}
                            {r.is_suspicious && r.suspicious_reason && (
                              <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 2 }}>⚠️ {r.suspicious_reason}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
            🔒 {tt('Записи журнала неизменяемы: их нельзя удалить или отредактировать.')}
          </div>
        </>
      )}
    </>
  );
}