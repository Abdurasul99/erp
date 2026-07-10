import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum, fmtMoneyFull, EmptyState } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const SEVERITY_META = {
  critical: { color: '#DC2626', badge: 'red',    icon: '🔴', label: 'Критично' },
  warning:  { color: '#D97706', badge: 'yellow', icon: '⚠️', label: 'Внимание' },
  info:     { color: '#1D4ED8', badge: 'blue',   icon: 'ℹ️', label: 'Инфо' },
};

const STATUS_META = {
  new:         { badge: 'gray',   label: 'Новая' },
  reviewed:    { badge: 'blue',   label: 'Просмотрено' },
  explained:   { badge: 'green',  label: 'Объяснено' },
  false_alarm: { badge: 'gray',   label: 'Ложная' },
};

const PERIODS = [
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

const TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'critical', label: '🔴 Критично' },
  { value: 'warning',  label: '⚠️ Внимание' },
  { value: 'info',     label: 'ℹ️ Инфо' },
];

// Метрики денежные форматируем суммой, число чеков — числом.
function fmtMetricVal(metric, v, tt) {
  if (metric === 'deals') return fmtNum(Math.round(v));
  return fmtMoneyFull(v) + ' ' + (tt ? tt('сум') : 'сум');
}

function AnomalyRow({ a, onReview, tt }) {
  const sev = SEVERITY_META[a.severity] || SEVERITY_META.info;
  const st = STATUS_META[a.status] || STATUS_META.new;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(a.review_note || '');
  const [saving, setSaving] = useState(false);
  const up = a.deviation_pct >= 0;

  async function save(status) {
    setSaving(true);
    try {
      await onReview(a.id, status, note);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
        <div style={{ width: 5, alignSelf: 'stretch', minHeight: 40, borderRadius: 3, background: sev.color }} />
        <div style={{ width: 36, height: 36, borderRadius: 9, background: sev.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{sev.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="list-item-title">{tt(a.metric_label)}</div>
            <Badge tone={sev.badge}>{up ? '▲' : '▼'} {Math.abs(a.deviation_pct).toFixed(0)}%</Badge>
            <Badge tone="gray">{a.branch_name || '—'}</Badge>
            <Badge tone={st.badge}>{tt(st.label)}</Badge>
          </div>
          <div className="list-item-sub" style={{ marginTop: 3 }}>
            {new Date(a.date).toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            {' · '}{tt('Норма')}: {fmtMetricVal(a.metric, a.expected_value, tt)}
            {' → '}{tt('Факт')}: <b style={{ color: sev.color }}>{fmtMetricVal(a.metric, a.actual_value, tt)}</b>
          </div>
          {a.possible_causes?.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {a.possible_causes.map((c, i) => (
                <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--bg-2)', color: 'var(--text2)' }}>{tt(c)}</span>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
          {open ? tt('Скрыть') : tt('Разбор →')}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10, paddingLeft: 51, width: '100%' }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={tt('Комментарий: что произошло в этот день…')}
            rows={2}
            style={{ width: '100%', resize: 'vertical', padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" disabled={saving} onClick={() => save('reviewed')}>{tt('Просмотрено')}</button>
            <button className="btn btn-sm" disabled={saving} onClick={() => save('explained')}>{tt('Объяснено')}</button>
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => save('false_alarm')}>{tt('Ложная тревога')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnomalyTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('week');
  const [tab, setTab] = useState('all');

  function load() {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/anomalies', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [branchId, period]);

  async function handleReview(id, status, note) {
    await api.patch(`/analytics/anomalies/${id}/review`, { status, note });
    setData(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, status, review_note: note } : i),
    } : prev);
  }

  const items = data?.items || [];
  const summary = data?.summary || {};
  const filtered = tab === 'all' ? items : items.filter(i => i.severity === tab);

  return (
    <>
      <PageHeader
        title={tt('🔬 Детектор аномалий')}
        sub={tt('Отклонения дня от 30-дн нормы по тому же дню недели')}
        actions={<Badge tone={summary.critical > 0 ? 'red' : 'green'}>
          {summary.critical > 0 ? `${summary.critical} ${tt('критичных')}` : tt('Норма')}
        </Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔴" label={tt('Критичные')} value={fmtNum(summary.critical)} sub={tt('|откл| > 50%')} color="#DC2626" />
            <Tile icon="⚠️" label={tt('Внимание')}  value={fmtNum(summary.warning)}  sub={tt('|откл| > 30%')} color="#D97706" />
            <Tile icon="ℹ️" label={tt('Инфо')}      value={fmtNum(summary.info)}     sub={tt('|откл| > 20%')} color="#1D4ED8" />
            <Tile icon="📂" label={tt('Не разобрано')} value={fmtNum(summary.open)}  sub={tt('новых')} color="#1D4ED8" />
          </div>

          <Card icon="📋" title={`${tt('Аномалии')} (${filtered.length})`}
            actions={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
                <Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />
              </div>
            }>
            {filtered.length === 0 ? (
              <EmptyState icon="✅" title={tt('Аномалий нет')}
                description={tt('За выбранный период метрики держатся в пределах нормы (±20%).')} />
            ) : (
              <div className="list">
                {filtered.map(a => (
                  <AnomalyRow key={a.id} a={a} onReview={handleReview} tt={tt} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}