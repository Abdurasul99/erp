import React, { useEffect, useState, useCallback } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';

// «Мои задачи» — окно исполнителя (кассир / продавец / складовщик, годится и менеджеру).
// Показывает ТОЛЬКО назначенные текущему сотруднику задачи (GET /api/tasks/my):
// руководитель ставит задачу с дедлайном на доске (Продажи → Задачи) — здесь она
// появляется у исполнителя; тот берёт в работу и отмечает «Готово», статус
// синхронизируется с доской руководителя.
const PRIORITY_META = {
  critical: { ru: 'Критично', uz: 'Kritik',   cls: 'badge-red' },
  high:     { ru: 'Высокий',  uz: 'Yuqori',   cls: 'badge-orange' },
  medium:   { ru: 'Средний',  uz: "O'rtacha", cls: 'badge-blue' },
  low:      { ru: 'Низкий',   uz: 'Past',     cls: 'badge-gray' },
};

export default function MyTasks({ onCount }) {
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const L = (ru, uzS) => (uz ? uzS : ru);

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(() => {
    api.get('/tasks/my')
      .then(r => { setData(r.data); setErr(null); onCount && onCount(r.data?.metrics?.active || 0); })
      .catch(e => setErr(e.response?.data?.error || e.message));
  }, [onCount]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (t, next) => {
    setBusyId(t.id);
    try {
      await api.patch(`/tasks/${t.id}/status`, { status: next });
      load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setBusyId(null);
  };

  const fmtDue = (t) => {
    if (!t.due_date) return null;
    const d = new Date(t.due_date);
    const s = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return t.due_time ? `${s} · ${String(t.due_time).slice(0, 5)}` : s;
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
            return (
              <div key={t.id} className="card" style={{ padding: '13px 16px', opacity: done ? .62 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                      <span className={'badge ' + pr.cls}>{uz ? pr.uz : pr.ru}</span>
                      {t.status === 'in_progress' && <span className="badge badge-blue">{L('В работе', 'Jarayonda')}</span>}
                      {t.overdue && <span className="badge badge-red">{L('Просрочено', 'Muddati o\'tgan')}</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {fmtDue(t) && <span style={{ color: t.overdue ? 'var(--red)' : 'var(--text3)', fontWeight: t.overdue ? 700 : 500 }}>{L('Срок', 'Muddat')}: {fmtDue(t)}</span>}
                      {t.creator_name && <span>{L('Поставил', 'Qo\'ydi')}: {t.creator_name}</span>}
                    </div>
                  </div>
                  {!done && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {t.status === 'todo' && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === t.id}
                          onClick={() => setStatus(t, 'in_progress')}>
                          {L('Взять в работу', 'Ishga olish')}
                        </button>
                      )}
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyId === t.id}
                        onClick={() => setStatus(t, 'done')}>
                        {busyId === t.id ? '…' : L('Готово', 'Bajarildi')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
