import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, BarChart, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'week',    label: 'Неделя' },
  { value: 'month',   label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year',    label: 'Год' },
];

const RATING_TONE = {
  excellent: { color: '#16A34A' },
  good:      { color: '#1D4ED8' },
  fair:      { color: '#D97706' },
  poor:      { color: '#DC2626' },
};

const PRIORITY_META = {
  high:   { label: 'Высокий', color: '#DC2626' },
  medium: { label: 'Средний', color: '#D97706' },
  low:    { label: 'Низкий',  color: '#94A3B8' },
};

function fmtHours(h) {
  const n = Number(h) || 0;
  if (n <= 0) return '—';
  return `${fmtNum(Math.round(n * 10) / 10)} ч`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getFullYear()).slice(2)}`;
}

export default function TaskAnalyticsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/tasks/analytics', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const summary = data?.summary || {};
  const byEmployee = data?.by_employee || [];
  const trend = data?.trend || [];
  const overdueNow = data?.overdue_now || [];
  const hasAny = (summary.total || 0) > 0 || byEmployee.length > 0 || overdueNow.length > 0;

  return (
    <>
      <PageHeader
        title={tt('📊 Аналитика выполнения задач')}
        sub={tt('Дедлайны · скорость · рейтинг сотрудников · текущие просрочки')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !hasAny ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📊</div><div>{tt('Нет задач за выбранный период')}</div></div></Card>
      ) : (
        <>
          {/* Сводка */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Всего задач')} value={fmtNum(summary.total || 0)} color="#1D4ED8" />
            <Tile icon="✅" label={tt('В срок')}
              value={`${fmtNum(summary.on_time_pct || 0)}%`}
              sub={`${fmtNum(summary.on_time || 0)} ${tt('из')} ${fmtNum(summary.total || 0)}`}
              color="#16A34A" />
            <Tile icon="⏰" label={tt('Просрочено')}
              value={fmtNum(summary.overdue || 0)}
              sub={`${fmtNum(summary.overdue_pct || 0)}%`}
              color="#DC2626" />
            <Tile icon="⚡" label={tt('Среднее время')} value={fmtHours(summary.avg_hours)} color="#D97706" />
          </div>

          {/* Тренд on-time % за 6 недель */}
          {trend.length > 0 && (
            <Card icon="📈" title={tt('Тренд выполнения в срок · 6 недель')} style={{ marginBottom: 16 }}>
              <BarChart
                data={trend.map(t => t.on_time_pct)}
                labels={trend.map(t => t.label)}
                color="#1D4ED8"
                height={110}
              />
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
                {tt('% задач, завершённых в срок, по неделе завершения')}
              </div>
            </Card>
          )}

          {/* По сотрудникам */}
          <Card icon="👥" title={tt('По сотрудникам')} style={{ marginBottom: 16 }}>
            {byEmployee.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>{tt('Нет назначенных задач за период')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Назначено')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('В срок')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Просрочено')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Ср. время')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Рейтинг')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byEmployee.map(e => {
                      const rt = RATING_TONE[e.rating_key] || RATING_TONE.fair;
                      return (
                        <tr key={e.employee_id}>
                          <td style={{ fontWeight: 700 }}>{e.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(e.assigned)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: rt.color }}>
                            {fmtNum(e.on_time_pct)}%
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: e.overdue ? 'var(--red)' : 'var(--text2)' }}>
                            {fmtNum(e.overdue)}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtHours(e.avg_hours)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: rt.color + '20', color: rt.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                              {e.rating_icon} {tt(e.rating)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              {tt('Рейтинг по % выполнения в срок: Отлично ≥85 · Хорошо ≥70 · Средне ≥50 · Плохо <50. «В срок» считается от завершённых задач сотрудника.')}
            </div>
          </Card>

          {/* Текущие просроченные */}
          <Card icon="🔴" title={`${tt('Текущие просроченные')} (${overdueNow.length})`} style={{ marginBottom: 16 }}>
            {overdueNow.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>{tt('Нет открытых просроченных задач 🎉')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Задача')}</th>
                      <th>{tt('Исполнитель')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Приоритет')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Срок')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Просрочка')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueNow.map(t => {
                      const pm = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 700 }}>
                            {t.title}
                            {!branchId && t.branch_name && (
                              <span style={{ fontSize: 10.5, color: 'var(--text3)', marginLeft: 6 }}>· {t.branch_name}</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text2)' }}>{t.assignee_name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: pm.color, fontWeight: 700, fontSize: 12 }}>{tt(pm.label)}</span>
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtDate(t.due_date)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>
                            <Badge tone="red">{fmtNum(t.days_overdue)} {tt('дн')}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}