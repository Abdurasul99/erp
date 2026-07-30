import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api.js';
import { Tile, Badge, Pills, Skeleton, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';
import { useTaskInbox } from '../../hooks/useTaskInbox.jsx';
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, KANBAN_COLS, SOURCE_META,
  EVENT_KIND_META, ROLE_LABELS, pickLabel, assigneeLabel, fmtDue, fmtAgo,
} from '../taskMeta.js';

// Переиспользуемая Trello-доска поручений: колонки todo/in_progress/done,
// нативный HTML5 drag&drop (библиотек DnD в проекте нет), боковая панель
// карточки с редактированием и лентой истории.
//
// Доска НЕ опрашивает /api/tasks по таймеру: этот роут дёргает
// generateTasksFromTemplates. Живое обновление приходит из useTaskInbox —
// счётчик version растёт, когда появилось новое непрочитанное событие.

const SCOPE_TABS = [
  { value: 'all',   ru: 'Все' },
  { value: 'by_me', ru: 'Я поставил' },
  { value: 'to_me', ru: 'Мне поручено' },
];

const EMPTY_COLS = { todo: [], in_progress: [], done: [] };
const EMPTY_FORM = { title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' };

const cloneCols = (prev) => KANBAN_COLS.reduce((acc, k) => { acc[k] = [...((prev && prev[k]) || [])]; return acc; }, {});

// Положить задачу в колонку её статуса. Если статус не изменился — обновляем
// карточку на месте (иначе редактирование прыгало бы наверх колонки).
function placeTask(prev, task) {
  const base = cloneCols(prev);
  const from = KANBAN_COLS.find(k => base[k].some(t => t.id === task.id));
  if (from && from === task.status) {
    base[from] = base[from].map(t => (t.id === task.id ? { ...t, ...task } : t));
    return base;
  }
  const old = from ? base[from].find(t => t.id === task.id) : null;
  if (from) base[from] = base[from].filter(t => t.id !== task.id);
  // cancelled на доске не показываем — карточка просто исчезает
  if (KANBAN_COLS.includes(task.status)) base[task.status] = [{ ...(old || {}), ...task }, ...base[task.status]];
  return base;
}

function dropTask(prev, id) {
  const base = cloneCols(prev);
  for (const k of KANBAN_COLS) base[k] = base[k].filter(t => t.id !== id);
  return base;
}

// Значение для <input type="date">: у DATE-колонки pg отдаёт локальную полночь,
// и toISOString() сдвинул бы дату на день назад в UTC+5.
function dateInputValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v.slice(0, 10) : '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const toEditForm = (t) => ({
  title: t?.title || '',
  description: t?.description || '',
  priority: t?.priority || 'medium',
  due_date: dateInputValue(t?.due_date),
  assignee_id: t?.assignee_id == null ? '' : String(t.assignee_id),
});

export default function TaskBoard({ branchId, scope = 'all', assigneeId, canCreate = true, canEdit = true, compact = false, onChanged }) {
  const { tt, lang } = useTt();
  const uz = lang === 'uz';
  const inbox = useTaskInbox();
  const version = (inbox && inbox.version) || 0;

  const [cols, setCols] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);            // ручная перезагрузка доски
  const [scopeVal, setScopeVal] = useState(scope);
  const [assignees, setAssignees] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [edit, setEdit] = useState(EMPTY_FORM);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsTick, setEventsTick] = useState(0);
  const [confirmDel, setConfirmDel] = useState(false);

  const reload = useCallback(() => setTick(v => v + 1), []);

  useEffect(() => { setScopeVal(scope); }, [scope]);

  // Доска. include_company_level нужен, чтобы при выбранном филиале не пропадали
  // задачи, поставленные директору (у него branch_id пустой).
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = { view: 'kanban', period: 'month' };
    if (branchId) { params.branch_id = branchId; params.include_company_level = 1; }
    if (scopeVal && scopeVal !== 'all') params.scope = scopeVal;
    if (assigneeId) params.assignee_id = assigneeId;
    api.get('/tasks', { params })
      .then(r => {
        if (ignore) return;
        setCols(r.data?.columns || EMPTY_COLS);
        setMetrics(r.data?.metrics || {});
        setError(null);
      })
      .catch(e => {
        if (ignore) return;
        setCols(EMPTY_COLS);
        setError(e.response?.data?.error || e.message);
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, scopeVal, assigneeId, version, tick]);

  // Кому текущий вправе поставить задачу — отдельный роут, /api/users для этого
  // не годится: он не режет список по матрице прав.
  useEffect(() => {
    if (!canCreate && !canEdit) return undefined;
    let ignore = false;
    api.get('/tasks/assignees')
      .then(r => { if (!ignore) setAssignees(Array.isArray(r.data) ? r.data : []); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [canCreate, canEdit]);

  // Карточка в боковой панели
  useEffect(() => {
    if (!openId) { setDetail(null); setConfirmDel(false); return undefined; }
    let ignore = false;
    setDetailLoading(true);
    setConfirmDel(false);
    api.get(`/tasks/${openId}`)
      .then(r => {
        if (ignore) return;
        const t = r.data?.task || r.data;
        setDetail(t);
        setEdit(toEditForm(t));
      })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setDetailLoading(false); });
    return () => { ignore = true; };
  }, [openId]);

  // История отдельным эффектом: она обновляется по version/eventsTick, а форма
  // редактирования при этом не должна затираться свежим ответом по задаче.
  useEffect(() => {
    if (!openId) { setEvents([]); return undefined; }
    let ignore = false;
    setEventsLoading(true);
    api.get(`/tasks/${openId}/events`)
      .then(r => { if (!ignore) setEvents(Array.isArray(r.data) ? r.data : (r.data?.events || [])); })
      .catch(() => { if (!ignore) setEvents([]); })
      .finally(() => { if (!ignore) setEventsLoading(false); });
    return () => { ignore = true; };
  }, [openId, version, eventsTick]);

  const afterChange = () => {
    if (onChanged) onChanged();
    if (inbox && inbox.refresh) inbox.refresh();
  };

  // Перенос карточки: сначала двигаем локально, при ошибке сервера возвращаем снимок.
  const setStatus = (task, next) => {
    if (!task || !next || busy || task.status === next) return;
    const snapshot = cols;
    setCols(prev => placeTask(prev, { ...task, status: next }));
    setBusy(true);
    api.patch(`/tasks/${task.id}/status`, { status: next })
      .then(r => {
        const fresh = r.data?.task;
        const merged = fresh ? { ...task, ...fresh } : { ...task, status: next };
        setCols(prev => placeTask(prev, merged));
        setDetail(d => (d && d.id === merged.id ? { ...d, ...merged } : d));
        setEventsTick(v => v + 1);
        setError(null);
        afterChange();
      })
      .catch(e => {
        setCols(snapshot);
        setError(e.response?.data?.error || e.message);
      })
      .finally(() => setBusy(false));
  };

  const onDropTo = (col) => {
    setDragOverCol(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const task = KANBAN_COLS.reduce((f, k) => f || ((cols && cols[k]) || []).find(t => t.id === id), null);
    if (task) setStatus(task, col);
  };

  const submitCreate = () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const body = { title: form.title.trim(), priority: form.priority };
    if (form.description.trim()) body.description = form.description.trim();
    if (form.assignee_id) body.assignee_id = form.assignee_id;
    if (form.due_date) body.due_date = form.due_date;
    if (branchId) body.branch_id = branchId;
    api.post('/tasks', body)
      .then(() => {
        setForm(EMPTY_FORM);
        setAdding(false);
        setError(null);
        reload();   // не вставляем оптимистично: задача может не попасть в текущий фильтр
        afterChange();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const submitEdit = () => {
    if (!detail || !canEdit || saving) return;
    const body = {};
    if (edit.title.trim() && edit.title.trim() !== (detail.title || '')) body.title = edit.title.trim();
    if (edit.description !== (detail.description || '')) body.description = edit.description || null;
    if (edit.priority !== detail.priority) body.priority = edit.priority;
    if (edit.due_date !== dateInputValue(detail.due_date)) body.due_date = edit.due_date || null;
    const curAssignee = detail.assignee_id == null ? '' : String(detail.assignee_id);
    if (edit.assignee_id !== curAssignee) body.assignee_id = edit.assignee_id ? parseInt(edit.assignee_id, 10) : null;
    if (Object.keys(body).length === 0) return;
    setSaving(true);
    api.patch(`/tasks/${detail.id}`, body)
      .then(r => {
        const fresh = r.data?.task || r.data;
        if (fresh && fresh.id) {
          setDetail(d => ({ ...d, ...fresh }));
          setEdit(toEditForm({ ...detail, ...fresh }));
        }
        setEventsTick(v => v + 1);
        setError(null);
        reload();   // смена исполнителя может вывести задачу из текущего фильтра
        afterChange();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const submitDelete = () => {
    if (!detail || !canEdit || saving) return;
    setSaving(true);
    const id = detail.id;
    api.delete(`/tasks/${id}`)
      .then(() => {
        setCols(prev => dropTask(prev, id));
        setOpenId(null);
        setError(null);
        afterChange();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const assigneeOption = (u) => {
    const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    const name = full || u.username || ('#' + u.id);
    if (u.is_self) return `${name} — ${tt('я')}`;
    const role = pickLabel(ROLE_LABELS[u.role], uz);
    return role ? `${name} · ${role}` : name;
  };

  const pad = compact ? 10 : 12;

  const TaskCard = ({ t }) => {
    const prio = PRIORITY_META[t.priority] || PRIORITY_META.medium;
    const src = SOURCE_META[t.source];
    return (
      <div
        draggable
        onDragStart={e => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setDragId(null)}
        onClick={() => setOpenId(t.id)}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${prio.color}`,
          borderRadius: 10, padding: pad, marginBottom: 8, cursor: 'pointer',
          opacity: dragId === t.id ? 0.4 : 1, boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <Badge tone={prio.tone}>{pickLabel(prio, uz)}</Badge>
          {t.source && t.source !== 'manual' && src && <Badge tone="gray">{pickLabel(src, uz)}</Badge>}
          {t.overdue && <Badge tone="red">{tt('Просрочено')}</Badge>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: 'var(--text)' }}>{t.title}</div>
        {!compact && t.description && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
        )}
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{assigneeLabel(t, uz)}</span>
          {t.due_date && <span style={{ color: t.overdue ? '#DC2626' : 'var(--text3)', fontWeight: 700 }}>{fmtDue(t, uz)}</span>}
          {t.branch_name && <span>{t.branch_name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
          {t.status !== 'todo' && (
            <button style={btnMove} disabled={busy} title={tt('Назад')}
              onClick={() => setStatus(t, t.status === 'in_progress' ? 'todo' : 'in_progress')}>←</button>
          )}
          {t.status !== 'done' && (
            <button style={btnMove} disabled={busy} title={tt('Дальше')}
              onClick={() => setStatus(t, t.status === 'todo' ? 'in_progress' : 'done')}>→</button>
          )}
        </div>
      </div>
    );
  };

  const detailAssignee = detail ? assigneeLabel(detail, uz) : '';

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pills value={scopeVal} onChange={setScopeVal}
          options={SCOPE_TABS.map(s => ({ value: s.value, label: tt(s.ru) }))} label={tt('Кому задача')} />
        {canCreate && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
            onClick={() => setAdding(a => !a)}>{adding ? tt('Свернуть') : tt('+ Задача')}</button>
        )}
      </div>

      {error && (
        <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>
      )}

      {canCreate && adding && (
        <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <div>
              <label style={lbl}>{tt('Название')}</label>
              <input className="input" value={form.title} placeholder={tt('Например: обновить витрину')}
                onChange={e => setForm({ ...form, title: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') submitCreate(); }} />
            </div>
            <div>
              <label style={lbl}>{tt('Исполнитель')}</label>
              <select className="input" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}>
                <option value="">{tt('Не назначен')}</option>
                {assignees.map(u => <option key={u.id} value={u.id}>{assigneeOption(u)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>{tt('Описание')}</label>
            <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={form.description}
              placeholder={tt('Детали (необязательно)')}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
            <div>
              <label style={lbl}>{tt('Приоритет')}</label>
              <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {PRIORITY_ORDER.map(k => <option key={k} value={k}>{pickLabel(PRIORITY_META[k], uz)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{tt('Срок')}</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={saving || !form.title.trim()} onClick={submitCreate}>
              {saving ? tt('Сохранение…') : tt('Создать')}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>
              {tt('Отмена')}
            </button>
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid-3" style={{ marginBottom: 14 }}>
          <Tile label={tt('Активные')} value={fmtNum(metrics.active)} sub={tt('в работе и в очереди')} color="#1D4ED8" />
          <Tile label={tt('Просрочено')} value={fmtNum(metrics.overdue)} sub={tt('срок прошёл')} color="#DC2626" />
          <Tile label={tt('Выполнено сегодня')} value={fmtNum(metrics.done_today)} sub={tt('закрыто за день')} color="#16A34A" />
        </div>
      )}

      {loading && !cols ? (
        <Skeleton height={compact ? 180 : 260} />
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
          {KANBAN_COLS.map(col => {
            const st = STATUS_META[col];
            const list = (cols && cols[col]) || [];
            const over = dragOverCol === col;
            return (
              <div key={col}
                onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                onDragLeave={() => setDragOverCol(c => (c === col ? null : c))}
                onDrop={() => onDropTo(col)}
                style={{
                  flex: '1 1 300px', minWidth: 280,
                  background: over ? '#EAF2FE' : 'var(--bg-2)',
                  border: over ? '2px dashed #0071E3' : '2px solid transparent',
                  borderRadius: 14, padding: pad, minHeight: compact ? 120 : 160,
                  transition: 'background .12s, border-color .12s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: st.color }}>{pickLabel(st, uz)}</span>
                  <span className="mono" style={{ marginLeft: 'auto', background: st.color + '18', color: st.color, fontWeight: 800, fontSize: 12, borderRadius: 20, padding: '2px 9px' }}>{list.length}</span>
                </div>
                {list.length === 0 ? (
                  <div style={{ padding: '14px 4px', fontSize: 12, color: 'var(--text3)' }}>
                    {col === 'done' ? tt('Пока ничего не завершено') : tt('Нет задач')}
                  </div>
                ) : list.map(t => <TaskCard key={t.id} t={t} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* === Боковая панель карточки: правка, удаление, история === */}
      {openId && (
        <div style={drawerOverlay} onClick={() => { if (!saving) setOpenId(null); }}>
          <aside style={drawerPanel} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{tt('Задача')}</div>
              {detail && <Badge tone={(STATUS_META[detail.status] || STATUS_META.todo).tone}>{pickLabel(STATUS_META[detail.status] || STATUS_META.todo, uz)}</Badge>}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={saving} onClick={() => setOpenId(null)}>{tt('Закрыть')}</button>
            </div>

            {detailLoading && !detail ? (
              <Skeleton height={160} />
            ) : !detail ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>{tt('Задача не найдена')}</div>
            ) : (
              <>
                {canEdit ? (
                  <>
                    <div>
                      <label style={lbl}>{tt('Название')}</label>
                      <input className="input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={lbl}>{tt('Описание')}</label>
                      <textarea className="input" style={{ minHeight: 64, resize: 'vertical' }} value={edit.description}
                        onChange={e => setEdit({ ...edit, description: e.target.value })} />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={lbl}>{tt('Исполнитель')}</label>
                      <select className="input" value={edit.assignee_id} onChange={e => setEdit({ ...edit, assignee_id: e.target.value })}>
                        <option value="">{tt('Не назначен')}</option>
                        {/* исполнитель задачи может быть вне списка доступных — показываем его отдельной строкой */}
                        {detail.assignee_id != null && !assignees.some(u => u.id === detail.assignee_id) && (
                          <option value={String(detail.assignee_id)}>{detailAssignee}</option>
                        )}
                        {assignees.map(u => <option key={u.id} value={u.id}>{assigneeOption(u)}</option>)}
                      </select>
                    </div>
                    <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={lbl}>{tt('Приоритет')}</label>
                        <select className="input" value={edit.priority} onChange={e => setEdit({ ...edit, priority: e.target.value })}>
                          {PRIORITY_ORDER.map(k => <option key={k} value={k}>{pickLabel(PRIORITY_META[k], uz)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>{tt('Срок')}</label>
                        <input className="input" type="date" value={edit.due_date} onChange={e => setEdit({ ...edit, due_date: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" disabled={saving || !edit.title.trim()} onClick={submitEdit}>
                        {saving ? tt('Сохранение…') : tt('Сохранить')}
                      </button>
                      {confirmDel ? (
                        <>
                          <button className="btn btn-sm" style={btnDanger} disabled={saving} onClick={submitDelete}>{tt('Подтвердить удаление')}</button>
                          <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setConfirmDel(false)}>{tt('Отмена')}</button>
                        </>
                      ) : (
                        <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setConfirmDel(true)}>{tt('Удалить')}</button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{detail.title}</div>
                    {detail.description && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{detail.description}</div>}
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{detailAssignee}</span>
                      {detail.due_date && <span>{fmtDue(detail, uz)}</span>}
                      {detail.branch_name && <span>{detail.branch_name}</span>}
                    </div>
                  </>
                )}

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ ...lbl, marginBottom: 8 }}>{tt('Статус')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['todo', 'in_progress', 'done', 'cancelled'].map(s => (
                      <button key={s}
                        className={'btn btn-sm ' + (detail.status === s ? 'btn-primary' : 'btn-ghost')}
                        disabled={busy || detail.status === s}
                        onClick={() => setStatus(detail, s)}>{pickLabel(STATUS_META[s], uz)}</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ ...lbl, marginBottom: 8 }}>{tt('История')}</div>
                  {eventsLoading && events.length === 0 ? (
                    <Skeleton height={60} />
                  ) : events.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tt('Событий пока нет')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {events.map(ev => {
                        const meta = EVENT_KIND_META[ev.kind] || EVENT_KIND_META.updated;
                        const from = STATUS_META[ev.from_status];
                        const to = STATUS_META[ev.to_status];
                        return (
                          <div key={ev.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 5 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                                {pickLabel(meta, uz)}
                                {ev.kind === 'status' && to && (
                                  <span style={{ fontWeight: 600, color: 'var(--text2)' }}>
                                    {' '}{from ? pickLabel(from, uz) : '—'} → {pickLabel(to, uz)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                {[ev.actor_name && ev.actor_name.trim(), fmtAgo(ev.created_at, uz)].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };
const btnMove = { width: 24, height: 22, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', lineHeight: 1, padding: 0 };
const btnDanger = { background: '#DC2626', color: '#FFFFFF', border: '1px solid #DC2626' };
const drawerOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' };
const drawerPanel = { background: 'var(--surface)', width: '100%', maxWidth: 460, height: '100%', overflowY: 'auto', padding: 22, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' };
