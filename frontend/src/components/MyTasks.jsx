import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { useTaskInbox } from '../hooks/useTaskInbox.jsx';
import { PRIORITY_META, STATUS_META, EVENT_KIND_META, pickLabel, fmtAgo } from '../owner/taskMeta.js';

// «Мои задачи» — окно исполнителя (кассир / продавец / складовщик, годится и менеджеру).
// Показывает ТОЛЬКО назначенные текущему сотруднику задачи (GET /api/tasks/my):
// руководитель ставит задачу с дедлайном на доске (Продажи → Задачи) — здесь она
// появляется у исполнителя; тот берёт в работу и отмечает «Готово», статус
// синхронизируется с доской руководителя.
// Статусы: сервер разрешает исполнителю только in_progress и done — отмены здесь нет.

export default function MyTasks({ onCount }) {
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const L = (ru, uzS) => (uz ? uzS : ru);
  const { version, markRead } = useTaskInbox();

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [histId, setHistId] = useState(null);   // раскрыта история одной задачи
  const [hist, setHist] = useState({});         // task_id → { loading, error, items }

  // Бейджи гасим ОДИН раз — при открытии окна. Иначе задача, прилетевшая в
  // течение смены, помечалась бы прочитанной ещё до того, как её увидели.
  const markedRef = useRef(false);

  const load = useCallback(() => {
    api.get('/tasks/my')
      .then(r => {
        setData(r.data); setErr(null);
        onCount && onCount(r.data?.metrics?.active || 0);
        if (!markedRef.current) {
          markedRef.current = true;
          const ids = (r.data?.items || []).filter(t => t.unread).map(t => t.id);
          // Один запрос на все видимые задачи: роут принимает task_id массивом.
          if (ids.length) markRead({ task_id: ids });
        }
      })
      .catch(e => setErr(e.response?.data?.error || e.message));
  }, [onCount, markRead]);

  // version растёт, когда пришло новое уведомление (поллинг счётчика). Без этой
  // подписки задача, поставленная в течение смены, появлялась бы только после
  // перезагрузки страницы. Сам /tasks/my по таймеру не дёргаем — он запускает
  // генерацию задач из шаблонов.
  useEffect(() => { load(); }, [load, version]);

  const loadHist = useCallback((taskId) => {
    setHist(h => ({ ...h, [taskId]: { loading: true, error: null, items: h[taskId]?.items || [] } }));
    api.get(`/tasks/${taskId}/events`)
      .then(r => {
        const items = Array.isArray(r.data) ? r.data : (r.data?.events || []);
        setHist(h => ({ ...h, [taskId]: { loading: false, error: null, items } }));
      })
      .catch(e => setHist(h => ({ ...h, [taskId]: { loading: false, error: e.response?.data?.error || e.message, items: [] } })));
  }, []);

  const toggleHist = (t) => {
    if (histId === t.id) { setHistId(null); return; }
    setHistId(t.id);
    if (!hist[t.id]) loadHist(t.id);
  };

  const setStatus = async (t, next) => {
    setBusyId(t.id);
    try {
      await api.patch(`/tasks/${t.id}/status`, { status: next });
      load();
      // История задачи устарела — в ней появилась запись о переводе статуса.
      if (histId === t.id) loadHist(t.id);
      else setHist(h => { if (!h[t.id]) return h; const n = { ...h }; delete n[t.id]; return n; });
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setBusyId(null);
  };

  const fmtDue = (t) => {
    if (!t.due_date) return null;
    const d = new Date(t.due_date);
    const s = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return t.due_time ? `${s} · ${String(t.due_time).slice(0, 5)}` : s;
  };

  // Строка ленты: для смены статуса показываем сам переход, для остального — вид события.
  const evLine = (ev) => {
    if (ev.kind === 'status' && STATUS_META[ev.to_status]) {
      const from = STATUS_META[ev.from_status];
      return `${from ? pickLabel(from, uz) : '—'} → ${pickLabel(STATUS_META[ev.to_status], uz)}`;
    }
    return pickLabel(EVENT_KIND_META[ev.kind], uz) || ev.kind;
  };

  if (err && !data) return <div className="card" style={{ padding: 20, color: 'var(--red)', fontWeight: 600 }}>{err}</div>;
  if (!data) return <div className="card" style={{ padding: 20, color: 'var(--text3)' }}>{L('Загрузка…', 'Yuklanmoqda…')}</div>;

  const m = data.metrics || {};
  const items = (data.items || []).filter(t => showDone ? true : t.status !== 'done');

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
      {/* Сводка */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="card" style={{ padding: '10px 16px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>{L('Активных', 'Faol')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{m.active || 0}</div>
        </div>
        <div className="card" style={{ padding: '10px 16px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>{L('Просрочено', 'Muddati o\'tgan')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: (m.overdue || 0) > 0 ? 'var(--red)' : 'var(--text)' }}>{m.overdue || 0}</div>
        </div>
        <div className="card" style={{ padding: '10px 16px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>{L('Готово сегодня', 'Bugun bajarildi')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{m.done_today || 0}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'center', marginLeft: 'auto' }}
          onClick={() => setShowDone(v => !v)}>
          {showDone ? L('Скрыть выполненные', 'Bajarilganlarni yashirish') : L('Показать выполненные', 'Bajarilganlarni ko\'rsatish')}
        </button>
      </div>

      {err && <div className="card" style={{ padding: '10px 14px', marginBottom: 10, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}

      {items.length === 0 ? (
        <div className="card" style={{ padding: 34, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{L('Задач нет', 'Vazifalar yo\'q')}</div>
          {L('Когда руководитель назначит вам задачу — она появится здесь.', 'Rahbar sizga vazifa belgilasa — shu yerda paydo bo\'ladi.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10 }}>
          {items.map(t => {
            const pr = PRIORITY_META[t.priority] || PRIORITY_META.medium;
            const done = t.status === 'done';
            const h = hist[t.id];
            return (
              <div key={t.id} className="card" style={{ padding: '13px 16px', opacity: done ? .62 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                      {/* Приоритет красим из общего словаря: классов badge-orange/badge-gray
                          в глобальном styles.css нет, и два приоритета выходили бесцветными. */}
                      <span className="badge" style={{ background: pr.color + '1F', color: pr.color }}>{pickLabel(pr, uz)}</span>
                      {t.unread && <span className="badge" style={{ background: '#DC2626', color: '#fff' }}>{L('Новая', 'Yangi')}</span>}
                      {t.status === 'in_progress' && <span className="badge badge-blue">{L('В работе', 'Jarayonda')}</span>}
                      {t.overdue && <span className="badge badge-red">{L('Просрочено', 'Muddati o\'tgan')}</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {fmtDue(t) && <span style={{ color: t.overdue ? 'var(--red)' : 'var(--text3)', fontWeight: t.overdue ? 700 : 500 }}>{L('Срок', 'Muddat')}: {fmtDue(t)}</span>}
                      {t.creator_name && <span>{L('Поставил', 'Qo\'ydi')}: {t.creator_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleHist(t)}>
                      {histId === t.id ? L('Скрыть историю', 'Tarixni yashirish') : L('История', 'Tarix')}
                    </button>
                    {!done && t.status === 'todo' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === t.id}
                        onClick={() => setStatus(t, 'in_progress')}>
                        {L('Взять в работу', 'Ishga olish')}
                      </button>
                    )}
                    {!done && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyId === t.id}
                        onClick={() => setStatus(t, 'done')}>
                        {busyId === t.id ? '…' : L('Готово', 'Bajarildi')}
                      </button>
                    )}
                  </div>
                </div>

                {histId === t.id && (
                  <div style={{ marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                    {h?.loading && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{L('Загрузка…', 'Yuklanmoqda…')}</div>}
                    {h?.error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{h.error}</div>}
                    {!h?.loading && !h?.error && (h?.items?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {h.items.map(ev => (
                          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: EVENT_KIND_META[ev.kind]?.color || '#6B7280' }} />
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{evLine(ev)}</span>
                            <span style={{ color: 'var(--text3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.actor_name || L('Система', 'Tizim')}
                            </span>
                            <span style={{ color: 'var(--text3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtAgo(ev.created_at, uz)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{L('Изменений пока нет', 'Hozircha o\'zgarishlar yo\'q')}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
