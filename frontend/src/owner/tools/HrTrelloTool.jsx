import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { BranchScope } from '../OwnerShell.jsx';
import { PageHeader, Skeleton, EmptyState } from '../ui.jsx';
import { useTt, fmtDate } from '../tt.js';

// Trello-доска задач команды (HR). Переиспользует /api/tasks (kanban-колонки todo/in_progress/done).
const PRIO = {
  critical: { c: '#dc2626', l: 'Критично' }, high: { c: '#ea580c', l: 'Высокий' },
  medium: { c: '#d97706', l: 'Средний' }, low: { c: '#16a34a', l: 'Низкий' },
};
const COLS = [
  { key: 'todo', title: 'Сделать', icon: '📋', color: '#6366f1' },
  { key: 'in_progress', title: 'В работе', icon: '⏳', color: '#d97706' },
  { key: 'done', title: 'Готово', icon: '✅', color: '#16a34a' },
];
const initials = (name, uname) => ((name && name.trim()) || uname || 'U').split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

export default function HrTrelloTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [cols, setCols] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // ключ колонки, куда добавляем (или null)
  const [form, setForm] = useState({ title: '', assignee_id: '', priority: 'medium', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/tasks', { params: { view: 'kanban', branch_id: branchId || undefined, period: 'year' } })
      .then(r => setCols(r.data.columns || { todo: [], in_progress: [], done: [] }))
      .catch(() => setCols({ todo: [], in_progress: [], done: [] }))
      .finally(() => setLoading(false));
  }, [branchId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/users').then(r => setUsers((r.data || []).filter(u => u.role !== 'admin'))).catch(() => {}); }, []);

  const move = async (task, to) => {
    setCols(prev => {
      const n = { todo: [...(prev.todo || [])], in_progress: [...(prev.in_progress || [])], done: [...(prev.done || [])] };
      for (const k of Object.keys(n)) n[k] = n[k].filter(t => t.id !== task.id);
      n[to] = [{ ...task, status: to }, ...n[to]];
      return n;
    });
    try { await api.patch(`/tasks/${task.id}/status`, { status: to }); } catch { load(); }
  };

  const addTask = async (colKey) => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/tasks', {
        title: form.title.trim(), assignee_id: form.assignee_id || null,
        priority: form.priority, due_date: form.due_date || null,
        branch_id: branchId || undefined,
      });
      setForm({ title: '', assignee_id: '', priority: 'medium', due_date: '' });
      setAdding(null);
      await new Promise(r => setTimeout(r, 150));
      load();
      // новую задачу бэк создаёт в 'todo'; если нужна другая колонка — двигаем после перезагрузки нельзя (нет id),
      // поэтому добавление всегда в «Сделать» (стандарт Trello).
    } catch (e) { /* тихо — валидацию покажет пустой title */ }
    setSaving(false);
  };

  if (loading || !cols) {
    return <><PageHeader title={tt('📋 Trello — задачи команды')} sub={tt('Ставь задачи сотрудникам и двигай по доске')} /><Skeleton height={300} /></>;
  }

  const total = (cols.todo?.length || 0) + (cols.in_progress?.length || 0) + (cols.done?.length || 0);
  const dueColor = (t) => t.overdue ? '#dc2626' : 'var(--text3)';

  const Card = ({ t, colKey }) => {
    const p = PRIO[t.priority] || PRIO.medium;
    const nameShort = (t.assignee_name && t.assignee_name.trim()) || t.assignee_username || tt('Не назначен');
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid #E9EEF6', padding: '10px 11px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.c, flexShrink: 0, marginTop: 5 }} title={tt(p.l)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text1)', lineHeight: 1.3 }}>{t.title}</div>
            {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="o-avatar" style={{ width: 20, height: 20, minWidth: 20, fontSize: 9 }}>{initials(t.assignee_name, t.assignee_username)}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{nameShort}</span>
              </span>
              {t.due_date && <span style={{ fontSize: 11, color: dueColor(t), fontWeight: 700 }}>📅 {fmtDate(t.due_date, { day: 'numeric', month: 'short' }, lang)}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {colKey !== 'todo' && <button onClick={() => move(t, colKey === 'in_progress' ? 'todo' : 'in_progress')} title={tt('Назад')} style={btnMove}>◀</button>}
            {colKey !== 'done' && <button onClick={() => move(t, colKey === 'todo' ? 'in_progress' : 'done')} title={tt('Дальше')} style={btnMove}>▶</button>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader title={tt('📋 Trello — задачи команды')} sub={`${tt('Ставь задачи сотрудникам и двигай по доске')} · ${total} ${tt('задач')}`} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
        {COLS.map(col => {
          const items = cols[col.key] || [];
          return (
            <div key={col.key} style={{ flex: '1 1 300px', minWidth: 280, background: 'var(--bg-2, #F4F7FE)', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.icon} {tt(col.title)} <span style={{ color: 'var(--text3)', fontWeight: 600 }}>· {items.length}</span></div>
                {col.key === 'todo' && <button onClick={() => setAdding(adding === 'todo' ? null : 'todo')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: col.color }}>+ {tt('Карточка')}</button>}
              </div>

              {col.key === 'todo' && adding === 'todo' && (
                <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid #E9EEF6', padding: 10, marginBottom: 8 }}>
                  <input autoFocus className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tt('Название задачи')} style={{ marginBottom: 7 }} onKeyDown={e => e.key === 'Enter' && addTask('todo')} />
                  <select className="input" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ marginBottom: 7 }}>
                    <option value="">{tt('— исполнитель —')}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.username} · {tt(u.role)}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
                    <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ flex: 1 }}>
                      {Object.keys(PRIO).map(k => <option key={k} value={k}>{tt(PRIO[k].l)}</option>)}
                    </select>
                    <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={{ flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button className="btn btn-primary btn-sm" disabled={saving || !form.title.trim()} onClick={() => addTask('todo')}>{saving ? tt('Сохранение…') : tt('Добавить')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(null); setForm({ title: '', assignee_id: '', priority: 'medium', due_date: '' }); }}>{tt('Отмена')}</button>
                  </div>
                </div>
              )}

              {items.length === 0
                ? <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 4px' }}>{col.key === 'done' ? tt('Пока ничего не завершено') : tt('Нет задач')}</div>
                : items.map(t => <Card key={t.id} t={t} colKey={col.key} />)}
            </div>
          );
        })}
      </div>
    </>
  );
}

const btnMove = { width: 22, height: 22, borderRadius: 6, border: '1px solid #E2E4F0', background: 'var(--surface)', cursor: 'pointer', fontSize: 10, color: 'var(--text2)', lineHeight: 1, padding: 0 };
