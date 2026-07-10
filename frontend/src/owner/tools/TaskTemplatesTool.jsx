import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate as fmtDateI18n } from '../tt.js';

const RECURRENCE_META = {
  daily:               { icon: '📅', label: 'Ежедневно' },
  daily_except_sunday: { icon: '📆', label: 'Ежедневно (кроме Вс)' },
  weekly_mon:          { icon: '🗓️', label: 'Еженедельно (Пн)' },
  weekly_sat:          { icon: '🗓️', label: 'Еженедельно (Сб)' },
  biweekly_1_15:       { icon: '🔁', label: '1 и 15 числа' },
  monthly_1:           { icon: '📌', label: '1 числа месяца' },
  monthly_last:        { icon: '📍', label: 'Последний день месяца' },
};

const ASSIGNEE_TYPE_META = {
  specific_employee: { label: 'Конкретный сотрудник' },
  role:              { label: 'По роли' },
  first_on_shift:    { label: 'Первый на смене' },
  manager:           { label: 'Менеджер' },
};

const ASSIGNEE_ROLE_META = {
  cashier:   { label: 'Кассир' },
  seller:    { label: 'Продавец' },
  warehouse: { label: 'Склад' },
  manager:   { label: 'Менеджер' },
};

const PRIORITY_META = {
  low:    { badge: 'gray', label: 'Низкий' },
  medium: { badge: 'blue', label: 'Средний' },
  high:   { badge: 'red',  label: 'Высокий' },
};

const EMPTY_FORM = {
  title: '', description: '',
  recurrence: 'daily', recurrence_time: '',
  assignee_type: 'manager', assignee_role: 'cashier',
  priority: 'medium',
};

export default function TaskTemplatesTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/task-templates', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [branchId]); // eslint-disable-line

  const summary = data?.summary || {};
  const items = data?.items || [];

  const submitCreate = () => {
    if (!form.title.trim()) { setError(tt('Укажите название задачи')); return; }
    setBusy(true); setError(null);
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      recurrence: form.recurrence,
      recurrence_time: form.recurrence_time || null,
      assignee_type: form.assignee_type,
      priority: form.priority,
    };
    if (form.assignee_type === 'role') body.assignee_role = form.assignee_role;
    if (branchId) body.branch_id = branchId;
    api.post('/task-templates', body)
      .then(() => { setShowCreate(false); setForm(EMPTY_FORM); load(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const toggleActive = (t) => {
    setBusy(true); setError(null);
    api.patch(`/task-templates/${t.id}`, { is_active: !t.is_active })
      .then(load)
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const fmtDate = (d) => d ? fmtDateI18n(d, { day: 'numeric', month: 'short' }, lang) : '—';
  const assigneeLabel = (t) => {
    if (t.assignee_type === 'specific_employee') return t.assignee_name || tt('Сотрудник');
    if (t.assignee_type === 'role') return tt(ASSIGNEE_ROLE_META[t.assignee_role]?.label || t.assignee_role || 'По роли');
    return tt(ASSIGNEE_TYPE_META[t.assignee_type]?.label || t.assignee_type);
  };

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

  return (
    <>
      <PageHeader
        title={tt('⚡ Шаблоны процессов')}
        sub={tt('Повторяющиеся задачи менеджера создаются автоматически')}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setError(null); setShowCreate(true); }}>
            {tt('+ Шаблон')}
          </button>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="⚡" label={tt('Активных шаблонов')} value={fmtNum(summary.active_templates)} sub={`${tt('всего')}: ${fmtNum(summary.total_templates)}`} color="#1D4ED8" />
            <Tile icon="🤖" label={tt('Авто-задач / мес')} value={fmtNum(summary.month_tasks)} sub={tt('за текущий месяц')} color="#0EA5E9" />
            <Tile icon="✅" label={tt('Выполнено')} value={fmtNum(summary.month_done)} sub={summary.completion_pct != null ? `${summary.completion_pct}% ${tt('выполнения')}` : tt('нет данных')} color="#16A34A" />
            <Tile icon="⏱️" label={tt('Сэкономлено')} value={`${fmtNum(summary.hours_saved)} ${tt('ч')}`} sub={tt('времени менеджера / мес')} color="#D97706" />
          </div>

          <Card icon="📋" title={`${tt('Шаблоны')} (${items.length})`}>
            <div className="list">
              {items.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                  {tt('Пока нет шаблонов. Создайте первый — рутина будет создаваться сама.')}
                </div>
              ) : items.map(t => {
                const rec = RECURRENCE_META[t.recurrence] || { icon: '🔁', label: t.recurrence };
                const pr = PRIORITY_META[t.priority] || { badge: 'gray', label: t.priority };
                return (
                  <div key={t.id} className="list-item" style={{ alignItems: 'flex-start', opacity: t.is_active ? 1 : .55 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{rec.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="list-item-title">{t.title}</div>
                        <Badge tone={t.is_active ? 'green' : 'gray'}>{t.is_active ? tt('Активен') : tt('Выключен')}</Badge>
                        <Badge tone={pr.badge}>{tt(pr.label)}</Badge>
                        {t.branch_name ? <Badge tone="gray">{t.branch_name}</Badge> : <Badge tone="gray">{tt('Все филиалы')}</Badge>}
                      </div>
                      <div className="list-item-sub" style={{ marginTop: 3 }}>
                        {tt(rec.label)}{t.recurrence_time ? ` · ${String(t.recurrence_time).slice(0, 5)}` : ''}
                        {' · '}{tt('исполнитель')}: {assigneeLabel(t)}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                        {tt('Следующая')}: {fmtDate(t.next_run)}
                        {' · '}{tt('выполнение')}: {t.completion_pct != null ? `${t.completion_pct}% (${t.tasks_completed}/${t.tasks_total})` : '—'}
                      </div>
                      {t.description && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text2)' }}>{t.description}</div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggleActive(t)}>
                        {t.is_active ? tt('Выключить') : tt('Включить')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* === Модалка: создать шаблон === */}
      {showCreate && (
        <div style={overlay} onClick={() => !busy && setShowCreate(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новый шаблон процесса')}</div>
            <div>
              <label style={lbl}>{tt('Название задачи')}</label>
              <input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tt('Напр.: Проверить кассу в конце дня')} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Описание')}</label>
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tt('необязательно')} />
            </div>
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>{tt('Периодичность')}</label>
                <select style={inp} value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                  {Object.entries(RECURRENCE_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Время создания')}</label>
                <input style={inp} type="time" value={form.recurrence_time} onChange={e => setForm({ ...form, recurrence_time: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>{tt('Исполнитель')}</label>
                <select style={inp} value={form.assignee_type} onChange={e => setForm({ ...form, assignee_type: e.target.value })}>
                  {Object.entries(ASSIGNEE_TYPE_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Приоритет')}</label>
                <select style={inp} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
            </div>
            {form.assignee_type === 'role' && (
              <div style={{ marginTop: 12 }}>
                <label style={lbl}>{tt('Роль')}</label>
                <select style={inp} value={form.assignee_role} onChange={e => setForm({ ...form, assignee_role: e.target.value })}>
                  {Object.entries(ASSIGNEE_ROLE_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
              {tt('«Первый на смене» и «Менеджер» назначаются автоматически по филиалу. Данных о сменах пока нет — «первый на смене» назначается на менеджера филиала.')}
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