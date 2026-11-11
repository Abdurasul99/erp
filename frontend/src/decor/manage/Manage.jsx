// «Управление» (ТЗ «Декор, обновление 2», раздел 2): задачи — матрица Эйзенхауэра (4 квадрата; перетаскивание меняет
// «срочно» и «важно»), канбан по статусам (перетаскивание меняет статус), карточка задачи; стандарты работ (раздел 3).
// Перетаскивание: мышью — за всю карточку, пальцем — за «ручку» слева (иначе список не прокрутить); на телефоне в канбане
// карточку бросают на кнопку статуса. То же можно сделать кнопками в карточке задачи.
// Права — с сервера (task.can): кто может менять квадрат, какие статусы доступны; «готово» — «принимать выполненные».
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fdm, localYmd, addDays } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, Sheet, Loading, DateInput } from '../kit.jsx';
import { QUADRANTS, quadrantOf, TASK_STATUSES, STATUS_TONE, taskTitle } from './taskText.js';
import { StandardsTab } from './Standards.jsx';

// ---------- Перетаскивание (pointer events: мышь и палец) ----------
function useDrag(onDrop) {
  const st = useRef(null);
  const justDragged = useRef(false);
  const cb = useRef(onDrop);
  cb.current = onDrop;
  const [ghost, setGhost] = useState(null);       // { task, x, y, over }
  useEffect(() => {
    // Во время перетаскивания док и верхняя панель «прозрачны» для указателя (класс dd-dragging) — бросить можно и в
    // квадрат, который они закрывают; у верхнего и нижнего края страница сама прокручивается.
    const zoneAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-drop]')?.getAttribute('data-drop') || null;
    let raf = 0;
    const scroll = () => {
      const s = st.current;
      if (!s?.active) { raf = 0; return; }
      const h = window.innerHeight;
      const dy = s.py > h - 150 ? Math.min(18, (s.py - (h - 150)) / 4 + 4) : s.py < 90 ? -Math.min(18, (90 - s.py) / 4 + 4) : 0;
      if (dy) {
        window.scrollBy(0, dy);
        setGhost(g => (g ? { ...g, over: zoneAt(s.px, s.py) } : g));
      }
      raf = requestAnimationFrame(scroll);
    };
    const end = () => { document.querySelector('.dd')?.classList.remove('dd-dragging'); if (raf) cancelAnimationFrame(raf); raf = 0; };
    const move = e => {
      const s = st.current;
      if (!s || e.pointerId !== s.pid) return;
      if (!s.active) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
        s.active = true; document.querySelector('.dd')?.classList.add('dd-dragging');
      }
      e.preventDefault();
      s.px = e.clientX; s.py = e.clientY;
      if (!raf) raf = requestAnimationFrame(scroll);
      setGhost({ task: s.task, x: e.clientX, y: e.clientY, over: zoneAt(e.clientX, e.clientY) });
    };
    const up = e => {
      const s = st.current;
      if (!s || e.pointerId !== s.pid) return;
      st.current = null;
      if (!s.active) return;
      const z = zoneAt(e.clientX, e.clientY);
      end(); setGhost(null);
      justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0);
      if (z) cb.current(s.task, z);
    };
    const cancel = () => { st.current = null; end(); setGhost(null); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { end(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }, []);
  const start = (e, task, handle) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType !== 'mouse' && !handle) return;      // пальцем — только за «ручку»
    st.current = { task, x: e.clientX, y: e.clientY, pid: e.pointerId, active: false };
    if (handle) e.preventDefault();
  };
  return { start, ghost, justDragged };
}

function TaskCard({ x, drag, onOpen, showStatus }) {
  const { t, lang } = useT();
  return (
    <div className={`dd-task ${x.overdue ? 'overdue' : ''} ${drag.ghost?.task.id === x.id ? 'dragging' : ''}`} role="button" tabIndex={0}
      data-task={x.id} onPointerDown={e => drag.start(e, x, false)}
      onClick={() => { if (!drag.justDragged.current) onOpen(x.id); }} onKeyDown={e => e.key === 'Enter' && onOpen(x.id)}>
      <span className="dd-task-grip" aria-hidden="true" onPointerDown={e => { e.stopPropagation(); drag.start(e, x, true); }}><Icon name="grip" size={16} /></span>
      <div className="dd-task-body">
        <b>{taskTitle(t, lang, x)}</b>
        <div className="dd-task-meta">
          {x.assignee && <span>{x.assignee.name}</span>}
          {x.due_date && <span className={x.overdue ? 'bad' : ''}>{t(x.overdue ? 'tkDueWas' : 'tkDue', { date: fdm(x.due_date, lang) })}</span>}
          {x.source === 'auto_client_date' && <Chip tone="blue">{t('tkAutoChip')}</Chip>}
          {showStatus && <Chip tone={STATUS_TONE[x.status]}>{t(`ts_${x.status}`)}</Chip>}
        </div>
      </div>
    </div>
  );
}

export default function Manage() {
  const { t, lang } = useT();
  const { me, toast, refreshHints } = useDecor();
  const [params, setParams] = useSearchParams();
  const tab = ['matrix', 'kanban', 'standards'].includes(params.get('tab')) ? params.get('tab') : 'matrix';
  const [list, err, reload, setList] = useLoad(() => api.get('/tasks').then(r => r.data), []);
  const [people] = useLoad(() => api.get('/tasks/people').then(r => r.data).catch(() => ({ people: [], can_assign: false, can_accept: false })), []);
  const actions = useActions();
  const [mineOnly, setMineOnly] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState('new');
  const openId = Number(params.get('open')) || null;
  const isNew = params.get('new') === '1';
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v === null) p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };
  const put = updated => setList(l => (l || []).map(x => (x.id === updated.id ? updated : x)));

  const drop = async (task, zone) => {
    try {
      if (zone.startsWith('q')) {
        if (quadrantOf(task) === zone) return;
        if (!task.can.edit) { toast(t('tkCantMove'), 'bad'); return; }
        const q = QUADRANTS.find(x => x.id === zone);
        const r = await actions.run(`q:${task.id}:${zone}`, cfg => api.put(`/tasks/${task.id}`, { urgent: q.urgent, important: q.important }, cfg));
        if (r) { put(r.data); toast(t('tkMoved', { q: t(`tq_${zone}`) })); }
      } else if (zone.startsWith('st:')) {
        const to = zone.slice(3);
        if (task.status === to) return;
        if (!task.can.moves.includes(to)) { toast(t(to === 'done' || task.status === 'done' ? 'tkCantAccept' : 'tkCantStatus'), 'bad'); return; }
        if (task.source === 'auto_client_date' && to === 'done') { setParam('open', String(task.id)); return; }   // итог звонка — в карточке
        const r = await actions.run(`st:${task.id}:${to}`, cfg => api.post(`/tasks/${task.id}/status`, { status: to }, cfg));
        if (r) { put(r.data); refreshHints(); toast(t('tkStatusSet', { s: t(`ts_${to}`) })); }
      }
    } catch (e) { toast(errText(e, t('error')), 'bad'); reload(); }
  };
  const drag = useDrag(drop);

  if (!list) return <><Hero id="manage" /><Loading err={err} retry={reload} /></>;
  const shown = list.filter(x => !mineOnly || x.assignee?.id === me.user.id);
  const open = shown.filter(x => x.status !== 'done');
  const overdue = open.filter(x => x.overdue).length;
  const card = id => setParam('open', String(id));
  const seesAll = people?.can_accept;
  return (
    <>
      <Hero id="manage" stats={[[open.length, t('tkStatOpen')], [overdue, t('tkStatOverdue')], [open.filter(x => x.status === 'review').length, t('tkStatReview')]]}
        acts={[{ label: t('tkNew'), onClick: () => setParam('new', '1') }]} />
      <Tabs value={tab} onChange={k => setParam('tab', k)} items={[['matrix', t('tkTabMatrix')], ['kanban', t('tkTabKanban')], ['standards', t('tkTabStandards')]]} />
      {tab !== 'standards' && (
        <div className="dd-row dd-between" style={{ gap: 8 }}>
          <p className="dd-note">{t(tab === 'matrix' ? 'tkMatrixNote' : 'tkKanbanNote')}</p>
          {seesAll && (
            <div className="dd-statuspick" role="tablist">
              <button type="button" className={!mineOnly ? 'on' : ''} onClick={() => setMineOnly(false)}>{t('tkAll')}</button>
              <button type="button" className={mineOnly ? 'on' : ''} onClick={() => setMineOnly(true)}>{t('tkMine')}</button>
            </div>
          )}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="dd-matrix">
          {QUADRANTS.map(q => {
            const items = open.filter(x => quadrantOf(x) === q.id);
            return (
              <div key={q.id} data-drop={q.id} className={`dd-quad ${q.id} ${drag.ghost?.over === q.id ? 'over' : ''}`}>
                <h4>{t(`tq_${q.id}`)} <Chip tone="gray">{items.length}</Chip></h4>
                <div className="dd-sub">{t(`tqd_${q.id}`)}</div>
                {items.map(x => <TaskCard key={x.id} x={x} drag={drag} onOpen={card} showStatus />)}
                {!items.length && <div className="dd-note dd-quad-empty">{t('tkEmptyQ')}</div>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'kanban' && <>
        <div className="dd-kanban only-wide">
          {TASK_STATUSES.map(s => {
            const col = shown.filter(x => x.status === s);
            return (
              <div key={s} data-drop={`st:${s}`} className={`dd-col ${drag.ghost?.over === `st:${s}` ? 'over' : ''}`}>
                <h4>{t(`ts_${s}`)} <Chip tone={STATUS_TONE[s]}>{col.length}</Chip></h4>
                {col.length ? col.map(x => <TaskCard key={x.id} x={x} drag={drag} onOpen={card} />) : <div className="dd-note" style={{ textAlign: 'center', padding: 10 }}>{t('colEmpty')}</div>}
              </div>
            );
          })}
        </div>
        <div className="only-narrow">
          <div className="dd-statuspick" role="tablist">
            {TASK_STATUSES.map(s => (
              <button key={s} type="button" role="tab" data-drop={`st:${s}`} aria-selected={phoneStatus === s}
                className={`${phoneStatus === s ? 'on' : ''} ${drag.ghost?.over === `st:${s}` ? 'over' : ''}`} onClick={() => setPhoneStatus(s)}>
                {t(`ts_${s}`)}<span>{shown.filter(x => x.status === s).length}</span>
              </button>
            ))}
          </div>
          <div className="dd-stack" style={{ marginTop: 12 }}>
            {shown.filter(x => x.status === phoneStatus).map(x => <TaskCard key={x.id} x={x} drag={drag} onOpen={card} />)}
            {!shown.some(x => x.status === phoneStatus) && <div className="dd-card dd-empty">{t('colEmpty')}</div>}
          </div>
        </div>
      </>}

      {tab === 'standards' && <StandardsTab />}

      {drag.ghost && (
        <div className="dd-task-ghost" style={{ left: drag.ghost.x, top: drag.ghost.y }}>{taskTitle(t, lang, drag.ghost.task)}</div>
      )}
      {(isNew || openId) && (
        <TaskSheet key={isNew ? 'new' : openId} id={isNew ? null : openId} people={people}
          onClose={() => { const p = new URLSearchParams(params); p.delete('open'); p.delete('new'); setParams(p, { replace: true }); }}
          onSaved={x => { setList(l => (l.some(y => y.id === x.id) ? l.map(y => (y.id === x.id ? x : y)) : [...l, x])); refreshHints(); }} />
      )}
    </>
  );
}

// ---------- Карточка задачи: просмотр, правка, статусы ----------
const RESULTS = ['tkResReached', 'tkResNoAnswer', 'tkResAgreed'];
function TaskSheet({ id, people, onClose, onSaved }) {
  const { t, lang } = useT();
  const { me, toast } = useDecor();
  const nav = useNavigate();
  const actions = useActions();
  const busy = !!actions.busy;
  const [task, err, reload] = useLoad(() => (id ? api.get(`/tasks/${id}`).then(r => r.data) : Promise.resolve(null)), [id]);
  const [f, setF] = useState(null);
  const [result, setResult] = useState('');
  useEffect(() => {
    if (id && !task) return;
    setF({ title: task?.title || '', description: task?.description || '', assignee_id: task?.assignee?.id || me.user.id,
      due_date: task ? (task.due_date || '') : addDays(localYmd(), 3), urgent: !!task?.urgent, important: task ? !!task.important : true });
  }, [task, id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (id && !task) return <Sheet title={t('tkCard')} onClose={onClose}><Loading err={err} retry={reload} /></Sheet>;
  if (!f) return null;
  const edit = !id || task.can.edit;
  const auto = task?.source === 'auto_client_date';
  const set = p => { setF({ ...f, ...p }); actions.reset('task'); };
  const changed = !id || ['title', 'description', 'assignee_id', 'due_date', 'urgent', 'important'].some(k => (k === 'assignee_id' ? (task.assignee?.id || null) : (task[k] ?? '')) !== (f[k] ?? ''));
  const save = async () => {
    const body = { title: f.title.trim(), description: f.description.trim() || null, assignee_id: Number(f.assignee_id), due_date: f.due_date || null,
      urgent: f.urgent, important: f.important };
    try {
      const r = await actions.run('task', cfg => (id ? api.put(`/tasks/${id}`, body, cfg) : api.post('/tasks', body, cfg)));
      if (r) { toast(t(id ? 'tkSaved' : 'tkCreated')); onSaved(r.data); if (id) reload(); else onClose(); }
    } catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  const move = async to => {
    try {
      const r = await actions.run(`status:${to}`, cfg => api.post(`/tasks/${id}/status`, { status: to, ...(to === 'done' && result.trim() ? { result: result.trim() } : {}) }, cfg));
      if (r) { toast(t('tkStatusSet', { s: t(`ts_${to}`) })); onSaved(r.data); reload(); }
    } catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  const who = (people?.people || []);
  const footer = <>
    <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
    {edit && <button type="button" className="dd-btn lg" disabled={busy || !f.title.trim() || !changed} onClick={save}><Icon name="check" size={18} /> {t(id ? 'saveBtn' : 'tkCreate')}</button>}
  </>;
  return (
    <Sheet title={id ? taskTitle(t, lang, task) : t('tkNew')} onClose={onClose} footer={footer}>
      {task && (
        <div className="dd-row" style={{ gap: 6 }}>
          <Chip tone={STATUS_TONE[task.status]}>{t(`ts_${task.status}`)}</Chip>
          <Chip tone="gray">{t(`tq_${quadrantOf(task)}`)}</Chip>
          {task.overdue && <Chip tone="bad">{t('tkOverdue')}</Chip>}
          {auto && <Chip tone="blue">{t('tkAutoChip')}</Chip>}
        </div>
      )}
      {task?.client && (
        <div className="dd-line">
          <div className="dd-line-head"><b>{task.client.name}</b>
            {task.client.phone && <a className="dd-btn ghost sm" href={`tel:${task.client.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={14} /> {task.client.phone}</a>}</div>
          {task.relative && <div className="dd-sub">{t(`rel_${task.relative.relation}`)} · {task.relative.name}{task.relative.not_married ? ` · ${t('relNotMarried')}` : ''}</div>}
          {me.permissions.includes('create_order') && <button type="button" className="dd-link" style={{ justifySelf: 'start' }} onClick={() => nav(`/decor/clients?open=${task.client.id}`)}>{t('tkOpenClient')} →</button>}
        </div>
      )}
      {task?.order && <button type="button" className="dd-btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => nav(`/decor/orders?open=${task.order.id}`)}>{t('cardOrder')} {task.order.no} →</button>}
      {edit && !auto ? <>
        <div className="dd-field"><label htmlFor="tk_title">{t('tkTitle')}</label>
          <input id="tk_title" className="dd-inp" maxLength={200} value={f.title} autoFocus={!id} onChange={e => set({ title: e.target.value })} /></div>
        <div className="dd-field"><label htmlFor="tk_desc">{t('tkDesc')}</label>
          <textarea id="tk_desc" className="dd-inp dd-textarea" rows={3} maxLength={4000} value={f.description} onChange={e => set({ description: e.target.value })} /></div>
      </> : (task?.description && <p className="dd-note" style={{ whiteSpace: 'pre-line' }}>{task.description}</p>)}
      {edit && <>
        <div className="dd-grid dd-g2" style={{ gap: 10 }}>
          <div className="dd-field"><label htmlFor="tk_who">{t('tkAssignee')}</label>
            <select id="tk_who" className="dd-inp" value={f.assignee_id} onChange={e => set({ assignee_id: Number(e.target.value) })}>
              {!who.some(p => p.id === f.assignee_id) && task?.assignee && <option value={task.assignee.id}>{task.assignee.name}</option>}
              {who.map(p => <option key={p.id} value={p.id}>{p.name} · {t(`r_${p.role}`)}</option>)}
            </select></div>
          <div className="dd-field"><label htmlFor="tk_due">{t('tkDueLabel')}</label><DateInput id="tk_due" value={f.due_date} onChange={v => set({ due_date: v })} /></div>
        </div>
        <div className="dd-row" style={{ gap: 8 }}>
          <button type="button" className={`dd-toggle ${f.urgent ? 'on' : ''}`} aria-pressed={f.urgent} onClick={() => set({ urgent: !f.urgent })}>{t('tkUrgent')}</button>
          <button type="button" className={`dd-toggle ${f.important ? 'on' : ''}`} aria-pressed={f.important} onClick={() => set({ important: !f.important })}>{t('tkImportant')}</button>
          <span className="dd-note">→ {t(`tq_${quadrantOf(f)}`)}</span>
        </div>
      </>}
      {task && !edit && (
        <div className="dd-nums">
          {task.assignee && <span>{t('tkAssignee')}: <b>{task.assignee.name}</b></span>}
          {task.due_date && <span>{t('tkDueLabel')}: <b>{fdm(task.due_date, lang)}</b></span>}
        </div>
      )}
      {task && (
        <div className="dd-sub">
          {task.created_by ? t('tkBy', { name: task.created_by.name }) : t('tkByServer')}
          {task.done_by ? ` · ${t('tkDoneBy', { name: task.done_by.name })}` : ''}
          {task.result ? ` · ${t('tkResult')}: ${task.result}` : ''}
        </div>
      )}
      {task && task.can.moves.length > 0 && (
        <div className="dd-line">
          <span className="dd-label">{t('tkMoveTo')}</span>
          {task.can.moves.includes('done') && auto && (
            <div className="dd-row" style={{ gap: 6 }}>
              {RESULTS.map(k => <button key={k} type="button" className={`dd-toggle ${result === t(k) ? 'on' : ''}`} onClick={() => setResult(t(k))}>{t(k)}</button>)}
              <input className="dd-inp" style={{ flex: '1 1 180px' }} maxLength={500} placeholder={t('tkResultPh')} value={result} onChange={e => setResult(e.target.value)} aria-label={t('tkResult')} />
            </div>
          )}
          <div className="dd-row" style={{ gap: 8 }}>
            {task.can.moves.map(s => (
              <button key={s} type="button" className={`dd-btn ${s === 'done' ? '' : 'ghost'}`} disabled={busy} onClick={() => move(s)}>
                {s === 'done' && <Icon name="check" size={16} />} {t(`tkTo_${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
