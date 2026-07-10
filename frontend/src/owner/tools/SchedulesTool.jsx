import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalBox = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };
const userName = (u) => (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || ('@' + u.username);

// Часы между HH:MM и HH:MM (обычная смена, при переходе за полночь +24ч)
function shiftHours(a, b) {
  if (!a || !b) return null;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  let d = (bh * 60 + bm) - (ah * 60 + am);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 10) / 10;
}

// Сдвиг недели: 0 = текущая, -1 = прошлая, +1 = следующая.
function weekRange(offset = 0) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = понедельник
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

export default function SchedulesTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ employee_id: '', work_date: '', start_time: '09:00', end_time: '18:00', status: 'planned' });

  const days = weekRange(weekOffset);
  const weekStart = iso(days[0]);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { week_start: weekStart };
    if (branchId) params.branch_id = branchId;
    return api.get('/hr/schedules', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, weekStart]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/users', { params }).then(r => setUsers(r.data || [])).catch(() => {});
  }, [branchId]);

  const submit = () => {
    if (!form.employee_id) { setFormError(tt('Выберите сотрудника')); return; }
    if (!form.work_date || !form.start_time || !form.end_time) { setFormError(tt('Укажите дату и время смены')); return; }
    setBusy(true); setFormError(null);
    const body = {
      employee_id: form.employee_id, work_date: form.work_date,
      start_time: form.start_time, end_time: form.end_time,
      hours: shiftHours(form.start_time, form.end_time), status: form.status,
    };
    if (branchId) body.branch_id = branchId;
    api.post('/hr/schedules', body)
      .then(() => {
        setShowForm(false);
        setForm({ employee_id: '', work_date: '', start_time: '09:00', end_time: '18:00', status: 'planned' });
        load();
      })
      .catch(e => setFormError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const rows = data?.rows || [];
  const warnings = data?.warnings || [];
  const templates = data?.templates || [];

  // Метрики недели.
  const totalShifts = rows.reduce((a, r) => a + (r.days || []).filter(d => d && d.start).length, 0);
  const totalHours = rows.reduce((a, r) => a + (r.total_hours || 0), 0);
  const uncovered = warnings.filter(w => w.type === 'uncovered').length;
  const overtimeHours = rows.reduce((a, r) => a + Math.max(0, (r.total_hours || 0) - 40), 0);

  // Карта: employee_id -> { 'YYYY-MM-DD': shift }
  const cellFor = (r, dKey) => (r.days || []).find(d => d && d.work_date === dKey);

  const weekLabel = `${ddmm(days[0])} — ${ddmm(days[6])}`;

  return (
    <>
      <PageHeader title={tt('🗓 Расписание и смены')} sub={tt('Недельный график · смены · переработки')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => { setForm(f => ({ ...f, work_date: f.work_date || iso(days[0]) })); setShowForm(true); }}>{tt('+ Смена')}</button>}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(weekOffset - 1)}>{tt('← Пред')}</button>
        <div style={{ fontWeight: 800, minWidth: 140, textAlign: 'center' }}>{weekLabel}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(weekOffset + 1)}>{tt('След →')}</button>
        {weekOffset !== 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>{tt('Текущая неделя')}</button>
        )}
      </div>

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="🗓" label={tt('Смен за неделю')} value={fmtNum(totalShifts)} sub={tt('всего')} color="#9333EA" />
            <Tile icon="⏱" label={tt('Плановые часы')} value={fmtNum(totalHours)} sub={tt('часов команды')} color="#1D4ED8" />
            <Tile icon="🕳" label={tt('Незакрытые смены')} value={fmtNum(uncovered)} sub={tt('без сотрудника')} color="#DC2626" />
            <Tile icon="🔥" label={tt('Переработки')} value={fmtNum(overtimeHours)} sub={tt('часов сверх 40ч')} color="#D97706" />
          </div>

          {warnings.length > 0 && (
            <Card icon="⚠️" title={tt('Предупреждения')} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: w.type === 'uncovered' ? 'rgba(220,38,38,.07)' : 'rgba(217,119,6,.07)',
                    border: '1px solid ' + (w.type === 'uncovered' ? 'rgba(220,38,38,.2)' : 'rgba(217,119,6,.2)'),
                  }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{w.type === 'uncovered' ? '🕳' : '🔥'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {w.type === 'uncovered' ? tt('Незакрытая смена') : tt('Переработка')}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>{w.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card icon="🗂" title={tt('Недельный график')} style={{ marginBottom: 18 }}>
            {rows.length === 0 ? (
              <EmptyState icon="🗓" title={tt('Смен нет')} description={tt('На эту неделю смены ещё не запланированы.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      {days.map((d, i) => (
                        <th key={i} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {tt(DOW[i])}<div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{ddmm(d)}</div>
                        </th>
                      ))}
                      <th style={{ textAlign: 'right' }}>{tt('Часов')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const init = (r.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                      const over = (r.total_hours || 0) > 40;
                      return (
                        <tr key={r.employee_id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                              <div>
                                <div style={{ fontWeight: 700 }}>{r.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.branch || '—'}</div>
                              </div>
                            </div>
                          </td>
                          {days.map((d, i) => {
                            const c = cellFor(r, iso(d));
                            return (
                              <td key={i} style={{ textAlign: 'center', fontSize: 12 }}>
                                {c && c.start ? (
                                  <span className="mono" title={c.status} style={{
                                    color: c.status === 'planned' ? 'var(--text)' : 'var(--text2)',
                                  }}>{hhmm(c.start)}–{hhmm(c.end)}</span>
                                ) : (
                                  <span style={{ color: 'var(--text3)' }}>—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: over ? 'var(--red)' : 'var(--text)' }}>
                            {r.total_hours != null ? fmtNum(r.total_hours) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🧩" title={tt('Шаблоны смен')}>
            {templates.length === 0 ? (
              <EmptyState icon="🧩" title={tt('Шаблонов нет')} description={tt('Добавьте шаблоны смен, чтобы быстро назначать график.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Название')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Начало')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Конец')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Перерыв')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}><Badge tone="purple">{t.name}</Badge></td>
                        <td className="mono" style={{ textAlign: 'center' }}>{hhmm(t.start_time)}</td>
                        <td className="mono" style={{ textAlign: 'center' }}>{hhmm(t.end_time)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{t.break_min != null ? `${t.break_min} ${tt('мин')}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Часы считаются по факту отметок (attendance). Если отметок нет — показывается прочерк.')}
            </div>
          </Card>
        </>
      )}

      {showForm && (
        <div style={overlay} onClick={() => !busy && setShowForm(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новая смена')}</div>
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
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>{tt('Начало')}</label>
                <input style={inp} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>{tt('Конец')}</label>
                <input style={inp} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Статус')}</label>
              <select style={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planned">{tt('Запланирована')}</option>
                <option value="confirmed">{tt('Подтверждена')}</option>
              </select>
            </div>
            {form.start_time && form.end_time && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                {tt('Часов')}: <b>{shiftHours(form.start_time, form.end_time)}</b>
              </div>
            )}
            {formError && <div style={{ marginTop: 12, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>⚠️ {formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setShowForm(false)}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submit}>{tt('Создать')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
