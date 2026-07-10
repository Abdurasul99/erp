import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const TYPE_META = {
  vacation: { label: 'Отпуск',     icon: '🏖', badge: 'blue'   },
  sick:     { label: 'Больничный', icon: '🤒', badge: 'orange' },
};

const STATUS_META = {
  approved: { label: 'Одобрено', icon: '✅', badge: 'green'  },
  pending:  { label: 'Ожидает',  icon: '⏳', badge: 'yellow' },
  rejected: { label: 'Отклонено', icon: '🚫', badge: 'red'   },
};

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const ANNUAL_DAYS = 21; // оплачиваемый отпуск по ТК РУз

function fmtD(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.floor((new Date(b) - new Date(a)) / 86400000) + 1;
}

export default function AbsencesTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [current, setCurrent] = useState(null);
  const [balance, setBalance] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('year');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    return Promise.all([
      api.get('/hr/absences/current', { params }),
      api.get('/hr/absences/balance', { params: branchId ? { branch_id: branchId } : {} }),
    ])
      .then(([c, b]) => { setCurrent(c.data); setBalance(b.data); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/users', { params }).then(r => setUsers(r.data || [])).catch(() => {});
  }, [branchId]);

  const metrics = current?.metrics || {};
  const active = current?.active || [];
  const scheduled = current?.scheduled || [];
  const rows = balance?.rows || [];

  const [form, setForm] = useState({ employee_id: '', type: 'vacation', start_date: '', end_date: '' });
  const submit = () => {
    if (!form.employee_id) { setError(tt('Выберите сотрудника')); return; }
    if (!form.start_date || !form.end_date) { setError(tt('Укажите даты начала и конца')); return; }
    setBusy(true); setError(null);
    const body = { employee_id: form.employee_id, type: form.type, start_date: form.start_date, end_date: form.end_date };
    if (branchId) body.branch_id = branchId;
    api.post('/hr/absences/request', body)
      .then(() => {
        setShowForm(false);
        setForm({ employee_id: '', type: 'vacation', start_date: '', end_date: '' });
        load();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const approve = (id) => {
    setBusy(true);
    api.patch(`/hr/absences/${id}/approve`, {})
      .then(load)
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const userName = (u) => (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || ('@' + u.username);

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

  const TypeBadge = ({ t }) => {
    const m = TYPE_META[t] || TYPE_META.vacation;
    return <Badge tone={m.badge}>{m.icon} {tt(m.label)}</Badge>;
  };
  const StatusBadge = ({ s }) => {
    const m = STATUS_META[s] || STATUS_META.pending;
    return <Badge tone={m.badge}>{m.icon} {tt(m.label)}</Badge>;
  };

  const empty = !loading && !error && active.length === 0 && scheduled.length === 0 && rows.length === 0;

  return (
    <>
      <PageHeader
        title={tt('🏖 Отпуска и больничные')}
        sub={tt('Текущие отсутствия · график отпусков · баланс дней (21 опл. день/год)')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>{tt('+ Заявка')}</button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
      </div>

      {error && <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>}

      {loading && !current ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : empty ? (
        <Card><EmptyState icon="🏖" title={tt('Отсутствий нет')} description={tt('Создайте заявку на отпуск или больничный кнопкой «+ Заявка».')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏖" label={tt('В отпуске сейчас')} value={fmtNum(metrics.on_vacation || 0)} sub={tt('сотрудников')} color="#1D4ED8" />
            <Tile icon="🤒" label={tt('На больничном')} value={fmtNum(metrics.on_sick || 0)} sub={tt('сотрудников')} color="#D97706" />
            <Tile icon="📅" label={tt('Дней отпуска за период')} value={fmtNum(metrics.vacation_days || 0)} sub={tt('по всем')} color="#16A34A" />
            <Tile icon="🩺" label={tt('Дней больничного за период')} value={fmtNum(metrics.sick_days || 0)} sub={tt('по всем')} color="#9333EA" />
          </div>

          <Card icon="🟢" title={tt('Текущие отсутствия')}>
            {active.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Сейчас никто не отсутствует')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Тип')}</th>
                      <th>{tt('Начало')}</th>
                      <th>{tt('Конец')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Дней')}</th>
                      <th>{tt('Статус')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700 }}>{a.employee_name || '—'}</td>
                        <td><TypeBadge t={a.type} /></td>
                        <td className="mono">{fmtD(a.start_date)}</td>
                        <td className="mono">{fmtD(a.end_date)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(a.days || daysBetween(a.start_date, a.end_date))}</td>
                        <td><StatusBadge s={a.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {a.status === 'pending' && (
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approve(a.id)}>{tt('Одобрить')}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="📆" title={tt('График отпусков')} style={{ marginTop: 16 }}>
            {scheduled.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Запланированных отпусков нет')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Тип')}</th>
                      <th>{tt('Начало')}</th>
                      <th>{tt('Конец')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Дней')}</th>
                      <th>{tt('Статус')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduled.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700 }}>{a.employee_name || '—'}</td>
                        <td><TypeBadge t={a.type} /></td>
                        <td className="mono">{fmtD(a.start_date)}</td>
                        <td className="mono">{fmtD(a.end_date)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(a.days || daysBetween(a.start_date, a.end_date))}</td>
                        <td><StatusBadge s={a.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {a.status === 'pending' && (
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approve(a.id)}>{tt('Одобрить')}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🧮" title={tt('Баланс отпускных дней')} style={{ marginTop: 16 }}>
            {rows.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных по сотрудникам')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Филиал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Положено/год')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Использовано')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Остаток')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const entitled = r.entitled != null ? r.entitled : ANNUAL_DAYS;
                      const used = r.used_days || 0;
                      const remain = r.remaining != null ? r.remaining : (entitled - used);
                      return (
                        <tr key={r.employee_id}>
                          <td style={{ fontWeight: 700 }}>{r.employee_name || '—'}</td>
                          <td style={{ color: 'var(--text2)' }}>{r.branch_name || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(entitled)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(used)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: remain <= 0 ? 'var(--red)' : 'var(--text)' }}>{fmtNum(remain)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ По ТК РУз — 21 оплачиваемый день отпуска в год. Остаток = положено − использовано (одобренные отпуска).')}
            </div>
          </Card>
        </>
      )}

      {showForm && (
        <div style={overlay} onClick={() => !busy && setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новая заявка')}</div>
            <div>
              <label style={lbl}>{tt('Сотрудник')}</label>
              <select style={inp} value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">{tt('— выберите —')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{userName(u)}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Тип')}</label>
              <select style={inp} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
              </select>
            </div>
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>{tt('Начало')}</label>
                <input style={inp} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>{tt('Конец')}</label>
                <input style={inp} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            {form.start_date && form.end_date && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                {tt('Дней')}: <b>{fmtNum(daysBetween(form.start_date, form.end_date))}</b>
              </div>
            )}
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

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modal = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
