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
  returned:    { color: '#9333EA', label: 'Возврат' }, // продано, но покупатель вернул
};
const STATUS_ORDER = ['new', 'in_progress', 'negotiation', 'won', 'lost', 'returned'];

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
  { value: 'returned',    label: 'Возвраты' },
];

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function daysSince(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// «Ожид. сумма сделки» — деньги в сумах, целое число. Поле хранится СТРОКОЙ:
// в onChange только чистка символов, нормализация — на blur.
// type="number" тут не годится: суммы крупные и их набирают с пробелами
// («1 500 000»), а на промежуточно-невалидном вводе Chrome отдаёт пустую
// e.target.value — контролируемое поле само себя очищало и лид сохранялся
// без суммы. Разряды-пробелы разрешаем набирать и убираем при нормализации.
const MAX_EST = 99999999999999;                       // leads.est_value NUMERIC(16,2)
const cleanSum = (s) => String(s).replace(/[^\d\s]/g, '').slice(0, 24);
const digitsOf = (s) => String(s).replace(/\D/g, '');
// Строка → число для отправки на сервер: пусто/мусор → 0 (как раньше), без NaN.
const parseSum = (s) => {
  const d = digitsOf(s);
  if (!d) return 0;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? Math.min(MAX_EST, n) : 0;
};

export default function LeadTrackerTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', source: 'phone', interest: '', est_value: '' });
  const [adding, setAdding] = useState(false);

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

  const addLead = () => {
    if (!form.name.trim()) return;
    setAdding(true);
    api.post('/marketing/leads', {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      source: form.source,
      interest: form.interest.trim() || null,
      est_value: parseSum(form.est_value),
    })
      .then(() => { setForm({ name: '', phone: '', source: 'phone', interest: '', est_value: '' }); setShowAdd(false); load(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setAdding(false));
  };

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
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone="green">{tt('Live')}</Badge>
            <button className="btn-primary" onClick={() => setShowAdd(v => !v)}
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: showAdd ? 'var(--border)' : 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: showAdd ? 'var(--text2)' : '#fff' }}>
              {showAdd ? tt('Закрыть') : '＋ ' + tt('Новый лид')}
            </button>
          </div>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {showAdd && (
        <Card icon="✍️" title={tt('Новый лид')} style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Имя / Компания')} *</div>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Телефон')}</div>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+998…"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Источник')}</div>
              <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13 }}>
                {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{tt(v)}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Ожид. сумма, сум')}</div>
              <input className="input" type="text" inputMode="numeric" value={form.est_value}
                onChange={e => setForm(f => ({ ...f, est_value: cleanSum(e.target.value) }))}
                onBlur={() => setForm(f => {
                  const d = digitsOf(f.est_value);
                  return { ...f, est_value: d ? String(Math.min(MAX_EST, parseInt(d, 10))) : '' };
                })}
                placeholder="0"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Интерес')}</div>
              <input className="input" value={form.interest} onChange={e => setForm(f => ({ ...f, interest: e.target.value }))}
                placeholder={tt('Что интересует клиента?')}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={addLead} disabled={!form.name.trim() || adding}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none',
                cursor: !form.name.trim() || adding ? 'not-allowed' : 'pointer', opacity: !form.name.trim() || adding ? 0.55 : 1,
                background: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: '#fff' }}>
              {adding ? tt('Сохранение…') : tt('Добавить лид')}
            </button>
            <button onClick={() => { setForm({ name: '', phone: '', source: 'phone', interest: '', est_value: '' }); setShowAdd(false); }}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: '1.5px solid var(--border)', cursor: 'pointer', background: '#fff', color: 'var(--text2)' }}>
              {tt('Отмена')}
            </button>
          </div>
        </Card>
      )}

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
