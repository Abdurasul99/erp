import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, BarChart, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Lead Tracker — воронка лидов: метрики (всего / в работе / конверсия / ср. время),
// помесячный график, таблица лидов со сменой статуса.
// Источник: новая таблица leads (см. бэкенд /api/marketing/leads).

const STATUS_META = {
  new:         { color: '#1D4ED8', label: 'Новый' },
  in_progress: { color: '#D97706', label: 'В работе' },
  negotiation: { color: '#7C3AED', label: 'Переговоры' },
  won:         { color: '#16A34A', label: 'Выиграно' },
  lost:        { color: '#DC2626', label: 'Потеряно' },
};
const STATUS_ORDER = ['new', 'in_progress', 'negotiation', 'won', 'lost'];

const SOURCE_LABEL = {
  instagram: 'Instagram',
  phone: 'Телефон',
  store: 'Магазин',
  online: 'Онлайн-магазин',
  site: 'Сайт',
  referral: 'Рекомендация',
  other: 'Другое',
};

const FILTERS = [
  { value: 'all',         label: 'Все' },
  { value: 'new',         label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'negotiation', label: 'Переговоры' },
  { value: 'won',         label: 'Выиграно' },
  { value: 'lost',        label: 'Потеряно' },
];

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function daysSince(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

export default function LeadTrackerTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/leads', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId]);

  const leads = data?.leads || [];
  const m = data?.metrics || {};
  const monthly = data?.monthly || [];

  const filtered = useMemo(
    () => filter === 'all' ? leads : leads.filter(l => l.status === filter),
    [leads, filter]
  );

  const chartData = monthly.map(x => x.count || 0);
  const chartLabels = monthly.map(x => {
    const [y, mo] = (x.month || '').split('-');
    return mo ? MONTHS_RU[parseInt(mo, 10) - 1] || x.month : x.month;
  });

  const changeStatus = (lead, status) => {
    if (status === lead.status) return;
    setSaving(lead.id);
    api.patch(`/marketing/leads/${lead.id}/status`, { status })
      .then(() => load())
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(null));
  };

  return (
    <>
      <PageHeader
        title={tt('📡 Лид-трекер')}
        sub={tt('Воронка лидов · источники · конверсия в продажу')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="👥" label={tt('Всего лидов')}   value={fmtNum(m.total || 0)}                       sub={tt('за всё время')}            color="var(--primary)" />
            <Tile icon="🔄" label={tt('В работе')}        value={fmtNum(m.in_progress || 0)}                 sub={tt('активные сделки')}         color="#D97706" />
            <Tile icon="🎯" label={tt('Конверсия')}       value={`${Math.round(m.conversion || 0)}%`}        sub={tt('лид → продажа')}           color="#16A34A" />
            <Tile icon="⏱️" label={tt('Среднее время')}   value={`${(m.avg_days || 0).toFixed(1)} ${tt('дн')}`} sub={tt('до закрытия сделки')}      color="#7C3AED" />
          </div>

          <Card icon="📊" title={tt('Лиды · по месяцам')} style={{ marginBottom: 16 }}>
            {chartData.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{tt('Нет данных за период')}</div>
            ) : (
              <BarChart data={chartData} labels={chartLabels} color="var(--primary)" />
            )}
          </Card>

          <Card
            icon="📋"
            title={`${tt('Список лидов')} (${filtered.length})`}
            actions={<Pills value={filter} onChange={setFilter} options={FILTERS.map(f => ({ ...f, label: tt(f.label) }))} />}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>{tt('Имя / Компания')}</th>
                    <th>{tt('Источник')}</th>
                    <th>{tt('Интерес')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Дней')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет лидов')}</td></tr>
                  ) : filtered.slice(0, 300).map(l => {
                    const sm = STATUS_META[l.status] || { color: 'var(--text2)', label: l.status };
                    return (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{l.name || tt('Без имени')}</div>
                          {(l.phone || l.email) && (
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.phone || l.email}</div>
                          )}
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{tt(SOURCE_LABEL[l.source] || l.source || '—')}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13, maxWidth: 220 }}>{l.interest || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            value={l.status}
                            disabled={saving === l.id}
                            onChange={e => changeStatus(l, e.target.value)}
                            style={{
                              background: sm.color + '18', color: sm.color, border: 'none',
                              padding: '4px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12,
                              cursor: 'pointer', appearance: 'none', textAlign: 'center',
                            }}
                          >
                            {STATUS_ORDER.map(s => (
                              <option key={s} value={s} style={{ color: 'var(--text)', background: 'var(--card, #fff)' }}>
                                {tt(STATUS_META[s].label)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtNum(l.days != null ? l.days : daysSince(l.created_at))}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(l.est_value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
