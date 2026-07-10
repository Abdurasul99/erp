import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Pills, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalBox = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };
const userName = (u) => (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || ('@' + u.username);
const todayIso = () => new Date().toISOString().slice(0, 10);
// Локальный ISO из даты (YYYY-MM-DD) и времени (HH:MM)
const toIso = (date, time) => (date && time ? `${date}T${time}:00` : null);

const STATUS = {
  present: { tone: 'green',  ru: 'Вовремя' },
  late:    { tone: 'orange', ru: 'Опоздание' },
  absent:  { tone: 'red',    ru: 'Прогул' },
  expected:{ tone: 'gray',   ru: 'Ожидается' },
};

const hhmm = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};
const dateRu = (s, lang) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return fmtDate(d, { day: '2-digit', month: 'short' }, lang);
};

export default function AttendanceTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ employee_id: '', work_date: todayIso(), actual_start: '09:00', actual_end: '18:00', status: 'present' });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    return api.get('/hr/attendance', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/users', { params }).then(r => setUsers(r.data || [])).catch(() => {});
  }, [branchId]);

  const submit = () => {
    if (!form.employee_id) { setFormError(tt('Выберите сотрудника')); return; }
    if (!form.work_date) { setFormError(tt('Укажите дату')); return; }
    const absent = form.status === 'absent';
    if (!absent && (!form.actual_start || !form.actual_end)) { setFormError(tt('Укажите время прихода и ухода')); return; }
    setBusy(true); setFormError(null);
    const body = {
      action: 'manual', employee_id: form.employee_id, work_date: form.work_date,
      actual_start: absent ? null : toIso(form.work_date, form.actual_start),
      actual_end: absent ? null : toIso(form.work_date, form.actual_end),
      status: form.status,
    };
    const cfg = branchId ? { params: { branch_id: branchId } } : {};
    api.post('/hr/attendance', body, cfg)
      .then(() => {
        setShowForm(false);
        setForm({ employee_id: '', work_date: todayIso(), actual_start: '09:00', actual_end: '18:00', status: 'present' });
        load();
      })
      .catch(e => setFormError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const summary = data?.summary || {};
  const today = data?.today || [];
  const log = data?.log || [];

  const stBadge = (s) => {
    const cfg = STATUS[s] || STATUS.expected;
    return <Badge tone={cfg.tone}>{tt(cfg.ru)}</Badge>;
  };

  return (
    <>
      <PageHeader title={tt('🕒 Табель и явка')} sub={tt('Часы · опоздания · прогулы · соблюдение графика')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>{tt('+ Отметить явку')}</button>}
      />

      <Card style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod} label="Период"
          options={PERIODS.map(p => ({ value: p.value, label: tt(p.label) }))} />
      </Card>

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="⏱" label={tt('Отработано часов')} value={fmtNum(summary.total_hours || 0)} sub={tt('за период')} color="#9333EA" />
            <Tile icon="⏰" label={tt('Опозданий')} value={fmtNum(summary.late_count || 0)} sub={tt('случаев')} color="#D97706" />
            <Tile icon="🚫" label={tt('Прогулов')} value={fmtNum(summary.absent_count || 0)} sub={tt('неявок')} color="#DC2626" />
            <Tile icon="✅" label={tt('Соблюдение графика')} value={`${fmtNum(summary.compliance_pct || 0)}%`} sub={tt('по плану')} color="#16A34A" />
          </div>

          <Card icon="📅" title={tt('Явка сегодня')} style={{ marginBottom: 18 }}>
            {today.length === 0 ? (
              <EmptyState icon="📭" title={tt('Нет записей на сегодня')} description={tt('Отметьте приход/уход сотрудников, чтобы заполнить табель.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('План (смена)')}</th>
                      <th>{tt('Приход')}</th>
                      <th>{tt('Уход')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Часы')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Опоздание')}</th>
                      <th>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {today.map((r, i) => {
                      const init = (r.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <tr key={r.id || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                              <div style={{ fontWeight: 700 }}>{r.name || '—'}</div>
                            </div>
                          </td>
                          <td className="mono" style={{ color: 'var(--text2)' }}>{hhmm(r.planned_start)} – {hhmm(r.planned_end)}</td>
                          <td className="mono">{hhmm(r.actual_start)}</td>
                          <td className="mono">{hhmm(r.actual_end)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{r.hours != null ? fmtNum(r.hours) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{r.late_minutes > 0 ? `${fmtNum(r.late_minutes)} ${tt('мин')}` : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td>{stBadge(r.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🗂" title={tt('Журнал явки за период')}>
            {log.length === 0 ? (
              <EmptyState icon="📭" title={tt('Журнал пуст')} description={tt('За выбранный период нет записей табеля.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата')}</th>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('План (смена)')}</th>
                      <th>{tt('Факт (приход–уход)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Часы')}</th>
                      <th>{tt('Примечание')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="mono">{dateRu(r.work_date, lang)}</td>
                        <td style={{ fontWeight: 600 }}>{r.name || '—'}</td>
                        <td className="mono" style={{ color: 'var(--text2)' }}>{hhmm(r.planned_start)} – {hhmm(r.planned_end)}</td>
                        <td className="mono" style={{ color: 'var(--text2)' }}>{hhmm(r.actual_start)} – {hhmm(r.actual_end)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{r.hours != null ? fmtNum(r.hours) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.status === 'absent'
                            ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>{tt('Прогул')}</span>
                            : r.late_minutes > 0
                              ? <span style={{ color: 'var(--orange, #D97706)' }}>{tt('Опоздание')} {fmtNum(r.late_minutes)} {tt('мин')}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Данные заполняются вручную при отметке прихода/ухода. Где отметки нет — показан прочерк.')}
            </div>
          </Card>
        </>
      )}

      {showForm && (
        <div style={overlay} onClick={() => !busy && setShowForm(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Отметить явку')}</div>
            <div>
              <label style={lbl}>{tt('Сотрудник')}</label>
              <select style={inp} value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">{tt('— выберите —')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{userName(u)}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Дата')}</label>
              <input style={inp} type="date" value={form.work_date} onChange={e => setForm({ ...form, work_date: e.target.value })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Статус')}</label>
              <select style={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="present">{tt('Вовремя')}</option>
                <option value="late">{tt('Опоздание')}</option>
                <option value="absent">{tt('Прогул')}</option>
              </select>
            </div>
            {form.status !== 'absent' && (
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div>
                  <label style={lbl}>{tt('Приход')}</label>
                  <input style={inp} type="time" value={form.actual_start} onChange={e => setForm({ ...form, actual_start: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>{tt('Уход')}</label>
                  <input style={inp} type="time" value={form.actual_end} onChange={e => setForm({ ...form, actual_end: e.target.value })} />
                </div>
              </div>
            )}
            {formError && <div style={{ marginTop: 12, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>⚠️ {formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setShowForm(false)}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submit}>{tt('Сохранить')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
