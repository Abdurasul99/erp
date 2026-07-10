import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const SEVERITY_META = {
  critical: { color: '#DC2626', badge: 'red',    label: 'Критично', icon: '🔴' },
  warning:  { color: '#D97706', badge: 'yellow', label: 'Внимание', icon: '🟡' },
  info:     { color: '#1D4ED8', badge: 'blue',   label: 'Инфо',     icon: '🔵' },
};

const MODULE_META = {
  inventory: { icon: '📦', label: 'Склад' },
  finance:   { icon: '💰', label: 'Финансы' },
  hr:        { icon: '👤', label: 'Персонал' },
  crm:       { icon: '🎧', label: 'CRM' },
  purchase:  { icon: '🏭', label: 'Закупки' },
};

const SEV_TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'critical', label: '🔴 Критично' },
  { value: 'warning',  label: '🟡 Внимание' },
  { value: 'info',     label: '🔵 Инфо' },
];

const MODULE_TABS = [
  { value: 'all',       label: 'Все модули' },
  { value: 'inventory', label: '📦 Склад' },
  { value: 'finance',   label: '💰 Финансы' },
  { value: 'crm',       label: '🎧 CRM' },
  { value: 'purchase',  label: '🏭 Закупки' },
];

export default function AlertCenterTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sevTab, setSevTab] = useState('all');
  const [modTab, setModTab] = useState('all');
  const [resolving, setResolving] = useState(null);
  const [creatingTask, setCreatingTask] = useState(null);
  const [taskMsg, setTaskMsg] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { status: 'open' };
    if (branchId) params.branch_id = branchId;
    return api.get('/analytics/alerts', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const resolve = (id) => {
    setResolving(id);
    api.patch(`/analytics/alerts/${id}/resolve`)
      .then(() => load())
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setResolving(null));
  };

  // Алерт → задача: создаёт поручение из алерта (наследует приоритет и срок по серьёзности).
  // 409 = задача по этому алерту уже есть.
  const createTask = (a) => {
    setCreatingTask(a.id); setTaskMsg(null);
    api.post('/tasks/from-alert', { alert_id: a.id })
      .then(() => setTaskMsg({ tone: 'green', text: tt('✓ Задача создана из алерта — см. «Задачи / Поручения»') }))
      .catch(e => {
        if (e.response?.status === 409) setTaskMsg({ tone: 'yellow', text: tt('Задача по этому алерту уже создана') });
        else setTaskMsg({ tone: 'red', text: e.response?.data?.error || e.message });
      })
      .finally(() => { setCreatingTask(null); setTimeout(() => setTaskMsg(null), 4000); });
  };

  const items = data?.items || [];
  const summary = data?.summary || {};
  const filtered = items.filter(a =>
    (sevTab === 'all' || a.severity === sevTab) &&
    (modTab === 'all' || a.module === modTab)
  );

  // Разбивка open-алертов по модулям
  const byModule = items.reduce((acc, a) => { acc[a.module] = (acc[a.module] || 0) + 1; return acc; }, {});

  return (
    <>
      <PageHeader
        title={tt('🚨 Центр алертов')}
        sub={tt('Единый экран всех уведомлений системы — по срочности')}
        actions={<Badge tone={summary.critical > 0 ? 'red' : 'green'}>
          {summary.critical > 0 ? `${summary.critical} ${tt('критичных')}` : tt('Всё спокойно')}
        </Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}
      {taskMsg && <div style={{ marginBottom: 12 }}><Badge tone={taskMsg.tone}>{taskMsg.text}</Badge></div>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔴" label={tt('Критичные')} value={fmtNum(summary.critical)} sub={tt('требуют действия сейчас')} color="#DC2626" />
            <Tile icon="🟡" label={tt('Внимание')}  value={fmtNum(summary.warning)}  sub={tt('в ближайшие 7 дней')} color="#D97706" />
            <Tile icon="🔵" label={tt('Инфо')}      value={fmtNum(summary.info)}     sub={tt('к сведению')} color="#1D4ED8" />
            <Tile icon="✅" label={tt('Решено сегодня')} value={fmtNum(summary.resolved_today)} sub={tt('закрыто за день')} color="#16A34A" />
          </div>

          <Card icon="📋" title={`${tt('Алерты')} (${filtered.length})`}
            actions={<Pills value={sevTab} onChange={setSevTab} options={SEV_TABS.map(t => ({ ...t, label: tt(t.label) }))} />}
            style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <Pills value={modTab} onChange={setModTab} options={MODULE_TABS.map(t => ({ ...t, label: tt(t.label) }))} />
            </div>
            <div className="list">
              {filtered.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                  {tt('✓ Нет открытых алертов — отличная работа!')}
                </div>
              ) : filtered.map((a) => {
                const sev = SEVERITY_META[a.severity] || SEVERITY_META.info;
                const mod = MODULE_META[a.module] || { icon: '📌', label: a.module };
                return (
                  <div key={a.id} className="list-item" style={{ alignItems: 'flex-start', cursor: a.action ? 'pointer' : 'default' }}
                    onClick={() => a.action && navigate(a.action)}>
                    <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: sev.color }} />
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: sev.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{mod.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="list-item-title">{a.title}</div>
                        <Badge tone={sev.badge}>{tt(sev.label)}</Badge>
                        <Badge tone="gray">{tt(mod.label)}</Badge>
                        {a.branch_name && <Badge tone="gray">{a.branch_name}</Badge>}
                      </div>
                      <div className="list-item-sub" style={{ marginTop: 3 }}>{a.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {a.action && (
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(a.action); }}>
                          {tt('Перейти →')}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={creatingTask === a.id}
                        title={tt('Создать поручение из этого алерта')}
                        onClick={e => { e.stopPropagation(); createTask(a); }}>
                        {creatingTask === a.id ? tt('...') : tt('📋 В задачу')}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={resolving === a.id}
                        onClick={e => { e.stopPropagation(); resolve(a.id); }}>
                        {resolving === a.id ? tt('...') : tt('✓ Решено')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {Object.keys(byModule).length > 0 && (
            <Card icon="📊" title={tt('По модулям')}>
              <div className="grid-4">
                {Object.entries(byModule).map(([mod, count]) => {
                  const meta = MODULE_META[mod] || { icon: '📌', label: mod };
                  return (
                    <div key={mod} role="button" tabIndex={0} aria-label={tt(meta.label)}
                      style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, cursor: 'pointer' }}
                      onClick={() => setModTab(mod)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModTab(mod); } }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{meta.icon}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt(meta.label)}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)', marginTop: 4 }} className="mono">{count}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}