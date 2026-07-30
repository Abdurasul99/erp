import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../owner/icons.jsx';
import { useTranslation } from '../useTranslation.js';
import { useTaskInbox } from '../hooks/useTaskInbox.jsx';
import { EVENT_KIND_META, STATUS_META, pickLabel, fmtAgo } from '../owner/taskMeta.js';

// Колокольчик уведомлений о задачах.
//
// Компонент живёт в ДВУХ оболочках: в топбаре панели (.owner-shell) и в
// staff-навбаре (/desktop, /mobile, /seller). Поэтому локаль берётся из
// useTranslation, а не из owner/tt.js — useTt существует только внутри панели.
//
// Бейдж показывает unread (новые события), а НЕ active: активных задач у
// сотрудника почти всегда несколько, и колокольчик горел бы круглосуточно,
// перестав что-либо значить.

// Собственные строки: i18n.js — общий словарь приложения, засорять его парой
// подписей одного виджета не нужно.
const L = {
  title:   { ru: 'Уведомления',            uz: 'Bildirishnomalar' },
  readAll: { ru: 'Прочитать все',          uz: "Hammasini o'qish" },
  empty:   { ru: 'Новых уведомлений нет',  uz: "Yangi bildirishnoma yo'q" },
  active:  { ru: 'В работе',               uz: 'Jarayonda' },
  overdue: { ru: 'Просрочено',             uz: "Muddati o'tgan" },
};
const say = (key, uz) => (uz ? L[key].uz : L[key].ru);

export default function NotificationsBell({ onOpenTask, variant = 'owner' }) {
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const inbox = useTaskInbox() || {};
  const {
    unread = 0, active = 0, overdue = 0, version = 0,
    items = [], itemsLoading = false,
    loadItems, markRead, markAllRead,
  } = inbox;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  // Функции провайдера держим в ref: если хук отдаст их без useCallback, прямая
  // зависимость в useEffect дала бы бесконечный цикл перезагрузки ленты.
  const loadRef = useRef(loadItems);
  loadRef.current = loadItems;

  // Лента грузится лениво — только при открытии, и перечитывается, когда
  // пришло новое событие (version), чтобы открытый попап не устаревал.
  useEffect(() => {
    if (!open) return;
    loadRef.current?.();
  }, [open, version]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickItem = (it) => {
    if (!it.read_at) markRead?.([it.id]);
    setOpen(false);
    if (it.task_id) onOpenTask?.(it.task_id);
  };

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div className="nbell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={'nbell' + (variant === 'staff' ? ' nbell-staff' : '') + (open ? ' open' : '')}
        onClick={() => setOpen((v) => !v)}
        aria-label={say('title', uz)}
        aria-expanded={open}
        title={say('title', uz)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="nbell-badge">{badge}</span>}
      </button>

      {open && (
        <div className="nbell-pop" role="dialog" aria-label={say('title', uz)}>
          <div className="nbell-pop-head">
            <span className="nbell-pop-title">{say('title', uz)}</span>
            <button
              type="button" className="nbell-readall"
              onClick={() => markAllRead?.()} disabled={!unread}
            >
              {say('readAll', uz)}
            </button>
          </div>

          {itemsLoading && !items.length ? (
            <div className="nbell-load">
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
            </div>
          ) : !items.length ? (
            <div className="nbell-empty">{say('empty', uz)}</div>
          ) : (
            <div className="nbell-list">
              {items.map((it) => {
                const meta = EVENT_KIND_META[it.kind];
                const flow = it.kind === 'status' && it.to_status
                  ? `${pickLabel(STATUS_META[it.from_status], uz) || '—'} → ${pickLabel(STATUS_META[it.to_status], uz)}`
                  : '';
                const sub = [it.actor_name, flow, fmtAgo(it.created_at, uz)].filter(Boolean).join(' · ');
                return (
                  <button
                    type="button" key={it.id}
                    className={'nbell-item' + (it.read_at ? '' : ' unread')}
                    onClick={() => pickItem(it)}
                  >
                    <span className="nbell-dot" style={{ background: meta?.color || '#6B7280' }} />
                    <span className="nbell-body">
                      <span className="nbell-kind" style={{ color: meta?.color || '#6B7280' }}>
                        {pickLabel(meta, uz) || it.kind}
                      </span>
                      <span className="nbell-task">{it.task_title || ''}</span>
                      {sub && <span className="nbell-meta">{sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="nbell-foot">
            <span>{say('active', uz)}: <b>{active}</b></span>
            {overdue > 0 && <span className="nbell-over">{say('overdue', uz)}: {overdue}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
