import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PRIORITY_META = {
  critical: { color: '#DC2626', badge: 'red',    label: 'Критично', icon: '🔴' },
  high:     { color: '#D97706', badge: 'yellow', label: 'Высокий',  icon: '🟠' },
  medium:   { color: '#1D4ED8', badge: 'blue',   label: 'Средний',  icon: '🔵' },
  low:      { color: '#6B7280', badge: 'gray',   label: 'Низкий',   icon: '⚪' },
};

const STATUS_META = {
  todo:        { color: '#1D4ED8', badge: 'blue',   label: 'Сделать',  icon: '📥' },
  in_progress: { color: '#D97706', badge: 'yellow', label: 'В работе', icon: '🔄' },
  done:        { color: '#16A34A', badge: 'green',  label: 'Готово',   icon: '✅' },
  cancelled:   { color: '#6B7280', badge: 'gray',   label: 'Отменено', icon: '🚫' },
};

const SOURCE_META = {
  manual:   { label: 'Вручную',   icon: '✍️' },
  system:   { label: 'Из алерта', icon: '🚨' },
  template: { label: 'Шаблон',    icon: '🔁' },
};

const KANBAN_COLS = ['todo', 'in_progress', 'done'];

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const VIEW_TABS = [
  { value: 'kanban', label: '🗂️ Доска' },
  { value: 'list',   label: '📋 Список' },
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function TasksTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('kanban');
  const [period, setPeriod] = useState('week');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [dragId, setDragId] = useState(null);       // id перетаскиваемой карточки
  const [dragOverCol, setDragOverCol] = useState(null); // колонка под курсором при перетаскивании

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = { view, period };
    if (branchId) params.branch_id = branchId;
    return api.get('/tasks', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, view, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/users', { params }).then(r => setUsers(r.data || [])).catch(() => {});
  }, [branchId]);

  const metrics = data?.metrics || {};

  const moveTo = (id, next) => {
    if (!id) return;
    setBusy(true);
    api.patch(`/tasks/${id}/status`, { status: next })
      .then(load)
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  // --- форма создания ---
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
  const submitCreate = () => {
    if (!form.title.trim()) { setError(tt('Укажите название задачи')); return; }
    setBusy(true);
    const body = { title: form.title, description: form.description, priority: form.priority };
    if (form.assignee_id) body.assignee_id = form.assignee_id;
    if (form.due_date) body.due_date = form.due_date;
    if (branchId) body.branch_id = branchId;
    api.post('/tasks', body)
      .then(() => {
        setShowCreate(false);
        setForm({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
        load();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

  const userName = (u) => (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || ('@' + u.username);

  const TaskCard = ({ t }) => {
    const prio = PRIORITY_META[t.priority] || PRIORITY_META.medium;
    const src = SOURCE_META[t.source] || SOURCE_META.manual;
    return (
      <div
        draggable
        onDragStart={e => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setDragId(null)}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: `4px solid ${prio.color}`,
          borderRadius: 10, padding: 12, marginBottom: 10,
          cursor: 'grab', opacity: dragId === t.id ? 0.4 : 1,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <Badge tone={prio.badge}>{prio.icon} {tt(prio.label)}</Badge>
          {t.source !== 'manual' && <Badge tone="gray">{src.icon} {tt(src.label)}</Badge>}
          {t.overdue && <Badge tone="red">{tt('Просрочено')}</Badge>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{t.title}</div>
        {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{t.description}</div>}
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {t.assignee_name ? <span>👤 {t.assignee_name}</span> : <span>👤 {tt('Не назначен')}</span>}
          {t.due_date && <span style={{ color: t.overdue ? 'var(--red)' : 'var(--text3)' }}>📅 {fmtDate(t.due_date)}</span>}
          {t.branch_name && <span>🏬 {t.branch_name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {t.status === 'todo' && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'in_progress')}>{tt('В работу →')}</button>
          )}
          {t.status === 'in_progress' && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'done')}>{tt('Готово ✓')}</button>
          )}
          {t.status !== 'done' && t.status !== 'cancelled' && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'cancelled')}>{tt('Отменить')}</button>
          )}
          {t.status === 'done' && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'todo')}>{tt('↩ Вернуть')}</button>
          )}
        </div>
      </div>
    );
  };

  const columns = data?.columns || { todo: [], in_progress: [], done: [] };
  const listItems = data?.items || [];

  return (
    <>
      <PageHeader
        title={tt('📋 Задачи / Поручения')}
        sub={tt('Kanban-доска поручений · ручные и авто-задачи из алертов')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={metrics.overdue > 0 ? 'red' : 'green'}>
              {metrics.overdue > 0 ? `${metrics.overdue} ${tt('просрочено')}` : tt('Без просрочек')}
            </Badge>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{tt('+ Задача')}</button>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Pills value={view} onChange={setView} options={VIEW_TABS.map(t => ({ ...t, label: tt(t.label) }))} />
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🗂️" label={tt('Активные')} value={fmtNum(metrics.active)} sub={tt('в работе и в очереди')} color="#1D4ED8" />
            <Tile icon="✅" label={tt('Выполнено сегодня')} value={fmtNum(metrics.done_today)} sub={tt('закрыто за день')} color="#16A34A" />
            <Tile icon="🔥" label={tt('Просрочено')} value={fmtNum(metrics.overdue)} sub={tt('срок прошёл')} color="#DC2626" />
            <Tile icon="📈" label={tt('Выполнение')} value={metrics.completion_pct == null ? '—' : metrics.completion_pct + '%'}
              sub={`${tt('готово/назначено')} · ${tt(PERIODS.find(p => p.value === metrics.period)?.label || 'период')}`} color="#D97706" />
          </div>

          {view === 'kanban' ? (
            <div className="grid-3">
              {KANBAN_COLS.map(col => {
                const st = STATUS_META[col];
                const list = columns[col] || [];
                return (
                  <div key={col}
                    onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                    onDragLeave={() => setDragOverCol(c => (c === col ? null : c))}
                    onDrop={() => { moveTo(dragId, col); setDragId(null); setDragOverCol(null); }}
                    style={{
                      background: dragOverCol === col ? 'var(--primary-50)' : 'var(--bg-2)',
                      border: dragOverCol === col ? '2px dashed var(--primary)' : '2px solid transparent',
                      borderRadius: 14, padding: 12, minHeight: 140, transition: 'background .12s, border-color .12s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>{st.icon}</span>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{tt(st.label)}</span>
                      <span style={{ marginLeft: 'auto', background: st.color + '18', color: st.color, fontWeight: 800, fontSize: 12, borderRadius: 20, padding: '2px 9px' }} className="mono">{list.length}</span>
                    </div>
                    {list.length === 0 ? (
                      <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>{tt('Пусто')}</div>
                    ) : list.map(t => <TaskCard key={t.id} t={t} />)}
                  </div>
                );
              })}
            </div>
          ) : (
            <Card icon="📋" title={`${tt('Все задачи')} (${listItems.length})`}>
              <div className="list">
                {listItems.length === 0 ? (
                  <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                    {tt('Задач пока нет — создайте первую')}
                  </div>
                ) : listItems.map(t => {
                  const prio = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                  const st = STATUS_META[t.status] || STATUS_META.todo;
                  const src = SOURCE_META[t.source] || SOURCE_META.manual;
                  return (
                    <div key={t.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: prio.color }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div className="list-item-title">{t.title}</div>
                          <Badge tone={st.badge}>{st.icon} {tt(st.label)}</Badge>
                          <Badge tone={prio.badge}>{tt(prio.label)}</Badge>
                          {t.source !== 'manual' && <Badge tone="gray">{src.icon} {tt(src.label)}</Badge>}
                          {t.overdue && <Badge tone="red">{tt('Просрочено')}</Badge>}
                          {t.branch_name && <Badge tone="gray">{t.branch_name}</Badge>}
                        </div>
                        {t.description && <div className="list-item-sub" style={{ marginTop: 3 }}>{t.description}</div>}
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                          {t.assignee_name ? `👤 ${t.assignee_name}` : tt('👤 Не назначен')}
                          {t.due_date ? ` · 📅 ${fmtDate(t.due_date)}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {t.status === 'todo' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'in_progress')}>{tt('В работу')}</button>}
                        {t.status === 'in_progress' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'done')}>{tt('Готово')}</button>}
                        {t.status !== 'done' && t.status !== 'cancelled' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveTo(t.id, 'cancelled')}>{tt('Отменить')}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* === Модалка: создать задачу === */}
      {showCreate && (
        <div style={overlay} onClick={() => !busy && setShowCreate(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новая задача')}</div>
            <div>
              <label style={lbl}>{tt('Название')}</label>
              <input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tt('Например: обновить витрину')} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Описание')}</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tt('Детали (необязательно)')} />
            </div>
            <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>{tt('Приоритет')}</label>
                <select style={inp} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Исполнитель')}</label>
                <select style={inp} value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}>
                  <option value="">{tt('Не назначен')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{userName(u)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Срок')}</label>
                <input style={inp} type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setShowCreate(false)}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submitCreate}>{tt('Создать')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modal = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };