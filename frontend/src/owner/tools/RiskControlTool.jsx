import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const SEVERITY_META = {
  critical: { color: '#DC2626', badge: 'red',    label: 'Критично' },
  warning:  { color: '#D97706', badge: 'yellow', label: 'Внимание' },
  info:     { color: '#1D4ED8', badge: 'blue',   label: 'Информация' },
};

const CATEGORY_META = {
  stock:          { icon: '📦', label: 'Склад' },
  debt:           { icon: '📒', label: 'Долг клиента' },
  'supplier-debt':{ icon: '🏭', label: 'Долг поставщику' },
  workflow:       { icon: '⏳', label: 'Процессы' },
  customer:       { icon: '👥', label: 'Клиенты' },
};

const TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'critical', label: '🔴 Критично' },
  { value: 'warning',  label: '🟡 Внимание' },
  { value: 'info',     label: '🔵 Инфо' },
];

export default function RiskControlTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/risks', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const alerts = data?.alerts || [];
  const summary = data?.summary || {};
  const filtered = tab === 'all' ? alerts : alerts.filter(a => a.severity === tab);

  // Group by category for the breakdown card
  const byCategory = alerts.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title={tt('⚠️ Контроль рисков')}
        sub={tt('Единая лента критических событий по всему бизнесу')}
        actions={<Badge tone={summary.critical > 0 ? 'red' : 'green'}>
          {summary.critical > 0 ? `${summary.critical} ${tt('критичных')}` : tt('Всё спокойно')}
        </Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔴" label={tt('Критичные')} value={fmtNum(summary.critical)} sub={tt('требуют действия сейчас')} color="#DC2626" />
            <Tile icon="🟡" label={tt('Внимание')}  value={fmtNum(summary.warning)}  sub={tt('разобраться в течение недели')} color="#D97706" />
            <Tile icon="🔵" label={tt('Инфо')}      value={fmtNum(summary.info)}     sub={tt('к сведению')} color="#1D4ED8" />
            <Tile icon="📊" label={tt('Всего')}     value={fmtNum(summary.total)}    sub={tt('алертов')} color="#1D4ED8" />
          </div>

          <Card icon="📋" title={`${tt('Алерты')} (${filtered.length})`} actions={<Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />}
            style={{ marginBottom: 16 }}>
            <div className="list">
              {filtered.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                  {tt('✓ Нет алертов в этой категории — отличная работа!')}
                </div>
              ) : filtered.map((a, i) => {
                const sev = SEVERITY_META[a.severity];
                const cat = CATEGORY_META[a.category] || { icon: '📌', label: a.category };
                return (
                  <div key={i} className="list-item" style={{ alignItems: 'flex-start', cursor: a.action_url ? 'pointer' : 'default' }}
                    onClick={() => a.action_url && navigate(a.action_url)}>
                    <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: sev.color }} />
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: sev.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="list-item-title">{a.title}</div>
                        <Badge tone={sev.badge}>{tt(sev.label)}</Badge>
                        <Badge tone="gray">{tt(cat.label)}</Badge>
                      </div>
                      <div className="list-item-sub" style={{ marginTop: 3 }}>{a.detail}</div>
                    </div>
                    {a.action_url && (
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(a.action_url); }}>
                        {tt('Решить →')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {Object.keys(byCategory).length > 0 && (
            <Card icon="📊" title={tt('По категориям')}>
              <div className="grid-4">
                {Object.entries(byCategory).map(([cat, count]) => {
                  const meta = CATEGORY_META[cat] || { icon: '📌', label: cat };
                  return (
                    <div key={cat} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
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
