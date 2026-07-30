import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { AuthContext } from '../../App.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { Card, Tile, Badge, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';
import { useTaskInbox } from '../../hooks/useTaskInbox.jsx';
import { getUserSections } from '../modules.js';
import TaskBoard from './TaskBoard.jsx';
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, EVENT_KIND_META, PENALTY_CATS,
  ROLE_LABELS, disciplineLevel, pickLabel, fmtDue, fmtAgo,
} from '../taskMeta.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// Ролевой дашборд (учредитель / директор / менеджер). Один компонент на три
// роли: разницу в данных режет сервер, вёрстка общая.
//
// ⚠ Заголовок окна рисует ToolRouter из modules.js (внутри окна PageHeader
// возвращает null) — второго заголовка здесь быть не должно.
//
// Блок «Мои дела» — не личный блокнот: сюда падают задачи ОТ ВЫШЕСТОЯЩИХ
// (учредитель → директору, директор → менеджеру), поэтому у карточки есть
// постановщик, бейдж «Новая», кнопки статуса и история.

const ADJ_PERIODS = [
  { value: 'day',   ru: 'День' },
  { value: 'week',  ru: 'Неделя' },
  { value: 'month', ru: 'Месяц' },
  { value: 'year',  ru: 'Год' },
];

const SAL_STATUS = {
  draft:    { tone: 'gray',  ru: 'Черновик' },
  approved: { tone: 'blue',  ru: 'Утверждено' },
  paid:     { tone: 'green', ru: 'Выплачено' },
};

const EMPTY_SAL_SUM = { base: 0, commission: 0, bonus: 0, penalty: 0, total: 0 };
const EMPTY_ADJ_SUM = { bonus_total: 0, penalty_total: 0, net: 0, violations: 0 };

function curPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Последние 6 месяцев для пилюль ведомости: /hr/salaries принимает 'YYYY-MM',
// а /hr/adjustments — enum day|week|month|year, поэтому периоды у блоков разные.
// Считаем по порядковому номеру месяца, а не сдвигом даты: setMonth() на 29-м
// числе упирается в несуществующее 29 февраля и перескакивает на март —
// в списке появлялся один и тот же месяц дважды.
function lastMonths(n) {
  const now = new Date();
  const base = now.getFullYear() * 12 + now.getMonth();
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = base - i;
    out.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

export default function RoleBoardTool() {
  const { tt, lang } = useTt();
  const uz = lang === 'uz';
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { branchId } = useContext(BranchScope);
  const inbox = useTaskInbox();
  const version = (inbox && inbox.version) || 0;
  const markRead = inbox && inbox.markRead;
  const myId = user?.id || null;
  const role = user?.role;

  // ─── Мои дела ─────────────────────────────────────────────────────────────
  const [mine, setMine] = useState(null);
  const [mineLoading, setMineLoading] = useState(true);
  const [mineErr, setMineErr] = useState(null);
  const [mineTick, setMineTick] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [histId, setHistId] = useState(null);
  const [hist, setHist] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const [selfTitle, setSelfTitle] = useState('');
  const [selfPrio, setSelfPrio] = useState('medium');
  const [selfDue, setSelfDue] = useState('');
  const [selfSaving, setSelfSaving] = useState(false);
  // Какие задачи уже погасили — иначе каждая перезагрузка списка слала бы
  // markRead заново (а он сам дёргает refresh и список приезжает опять).
  const markedRef = useRef(new Set());

  // ─── Зарплаты ─────────────────────────────────────────────────────────────
  const [salPeriod, setSalPeriod] = useState(curPeriod());
  const [sal, setSal] = useState(null);
  const [salLoading, setSalLoading] = useState(true);
  const [salErr, setSalErr] = useState(null);

  // ─── Нарушения ────────────────────────────────────────────────────────────
  const [adjPeriod, setAdjPeriod] = useState('month');
  const [adj, setAdj] = useState(null);
  const [adjLoading, setAdjLoading] = useState(true);
  const [adjErr, setAdjErr] = useState(null);
  const [adjTick, setAdjTick] = useState(0);
  const [assignees, setAssignees] = useState([]);
  const [penEmp, setPenEmp] = useState('');
  const [penCat, setPenCat] = useState(PENALTY_CATS[0].value);
  const [penAmount, setPenAmount] = useState('');   // строка: кламп только на blur/submit
  const [penNote, setPenNote] = useState('');
  const [penSaving, setPenSaving] = useState(false);
  const [penErr, setPenErr] = useState(null);

  // Мои дела: живое обновление приходит из version (поллить /api/tasks нельзя —
  // роут дёргает генерацию задач из шаблонов).
  useEffect(() => {
    let ignore = false;
    setMineLoading(true);
    api.get('/tasks/my')
      .then(r => {
        if (ignore) return;
        setMine({ metrics: r.data?.metrics || {}, items: r.data?.items || [] });
        setMineErr(null);
      })
      .catch(e => { if (!ignore) setMineErr(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setMineLoading(false); });
    return () => { ignore = true; };
  }, [version, mineTick]);

  // Открыли дашборд — гасим уведомления по видимым задачам. Бейджи «Новая»
  // остаются до следующей перезагрузки списка, чтобы человек успел их увидеть.
  useEffect(() => {
    if (!mine || !markRead) return;
    const ids = (mine.items || [])
      .filter(t => t.unread && !markedRef.current.has(t.id))
      .map(t => t.id);
    if (ids.length === 0) return;
    ids.forEach(id => markedRef.current.add(id));
    // Серверного батча по нескольким task_id нет — шлём по одному.
    ids.forEach(id => { markRead({ task_id: id }); });
  }, [mine, markRead]);

  useEffect(() => {
    if (!histId) { setHist([]); return undefined; }
    let ignore = false;
    setHist([]);   // иначе при переключении задач мелькала чужая история
    setHistLoading(true);
    api.get(`/tasks/${histId}/events`)
      .then(r => { if (!ignore) setHist(Array.isArray(r.data) ? r.data : (r.data?.events || [])); })
      .catch(() => { if (!ignore) setHist([]); })
      .finally(() => { if (!ignore) setHistLoading(false); });
    return () => { ignore = true; };
  }, [histId, version]);

  useEffect(() => {
    let ignore = false;
    setSalLoading(true);
    const params = { period: salPeriod };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/salaries', { params })
      .then(r => { if (!ignore) { setSal(r.data); setSalErr(null); } })
      .catch(e => { if (!ignore) setSalErr(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setSalLoading(false); });
    return () => { ignore = true; };
  }, [salPeriod, branchId]);

  useEffect(() => {
    let ignore = false;
    setAdjLoading(true);
    const params = { period: adjPeriod };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/adjustments', { params })
      .then(r => { if (!ignore) { setAdj(r.data); setAdjErr(null); } })
      .catch(e => { if (!ignore) setAdjErr(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setAdjLoading(false); });
    return () => { ignore = true; };
  }, [adjPeriod, branchId, adjTick]);

  // Список для формы штрафа — из матрицы прав, а не из /api/users: менеджеру
  // сервер всё равно откажет по чужому филиалу и безфилиальным руководителям.
  useEffect(() => {
    let ignore = false;
    api.get('/tasks/assignees')
      .then(r => { if (!ignore) setAssignees(Array.isArray(r.data) ? r.data : []); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  // Ссылки «Открыть …» показываем, только если инструмент реально доступен
  // пользователю (роль + персональные blocked_tools) — иначе ссылка мёртвая.
  const hrLinks = useMemo(() => {
    const hr = getUserSections(user).find(s => s.id === 'hr');
    const ids = new Set((hr?.tools || []).map(t => t.id));
    return { salaries: ids.has('salaries'), adjustments: ids.has('hr-adjustments') };
  }, [user]);

  const salSum = sal?.summary || EMPTY_SAL_SUM;
  const salRows = sal?.rows || [];
  const adjSum = adj?.summary || EMPTY_ADJ_SUM;

  // Антирейтинг: by_employee отсортирован по чистому эффекту DESC, худшие —
  // в хвосте. Берём только тех, у кого реально были нарушения.
  const antiRating = useMemo(() => {
    const list = adj?.by_employee || [];
    return list.filter(r => r.violations > 0).slice().sort((a, b) => a.net - b.net).slice(0, 5);
  }, [adj]);

  const penEmployees = useMemo(() => assignees.filter(u => !u.is_self), [assignees]);

  const reloadMine = () => setMineTick(v => v + 1);

  const setMyStatus = (task, next) => {
    if (busyId || !task || task.status === next) return;
    setBusyId(task.id);
    api.patch(`/tasks/${task.id}/status`, { status: next })
      .then(r => {
        const fresh = r.data?.task;
        setMine(m => (m ? {
          ...m,
          items: (m.items || []).map(t => (t.id === task.id ? { ...t, ...(fresh || { status: next }) } : t)),
        } : m));
        setMineErr(null);
        if (inbox && inbox.refresh) inbox.refresh();
      })
      .catch(e => setMineErr(e.response?.data?.error || e.message))
      .finally(() => setBusyId(null));
  };

  const submitSelf = () => {
    if (!selfTitle.trim() || selfSaving || !myId) return;
    setSelfSaving(true);
    const body = { title: selfTitle.trim(), assignee_id: myId, priority: selfPrio };
    if (selfDue) body.due_date = selfDue;
    // branch_id не шлём: сервер наследует филиал исполнителя (то есть мой).
    api.post('/tasks', body)
      .then(() => {
        setSelfTitle(''); setSelfDue(''); setSelfPrio('medium'); setSelfOpen(false);
        setMineErr(null);
        reloadMine();
      })
      .catch(e => setMineErr(e.response?.data?.error || e.message))
      .finally(() => setSelfSaving(false));
  };

  const submitPenalty = (e) => {
    e.preventDefault();
    setPenErr(null);
    if (!penEmp) { setPenErr(tt('Выберите сотрудника')); return; }
    const amt = Math.round(parseFloat(normalizeDecimal(penAmount)) || 0);
    if (amt <= 0) { setPenErr(tt('Введите сумму')); return; }
    setPenSaving(true);
    api.post('/hr/adjustments', {
      employee_id: Number(penEmp), type: 'penalty', category: penCat,
      amount: amt, note: penNote.trim() || null,
    })
      .then(() => {
        setPenEmp(''); setPenAmount(''); setPenNote('');
        setAdjTick(v => v + 1);
      })
      .catch(err => setPenErr(err.response?.data?.error || err.message))
      .finally(() => setPenSaving(false));
  };

  const roleLabel = pickLabel(ROLE_LABELS[role], uz);
  const mineMetrics = mine?.metrics || {};
  const mineItems = mine?.items || [];

  return (
    <>
      {roleLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Badge tone="blue">{roleLabel}</Badge>
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
            {tt('Ваши дела, поручения команде, ведомость и дисциплина — в одном окне.')}
          </span>
        </div>
      )}

      {/* ═══ 1. Мои дела ═══ */}
      <Card
        title={tt('Мои дела')}
        style={{ marginBottom: 18 }}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelfOpen(o => !o)}>
            {selfOpen ? tt('Свернуть') : tt('+ Дело себе')}
          </button>
        }>
        <div className="grid-4" style={{ marginBottom: 14 }}>
          <Tile label={tt('Активные')} value={fmtNum(mineMetrics.active)} sub={tt('в работе и в очереди')} color="#1D4ED8" />
          <Tile label={tt('Просрочено')} value={fmtNum(mineMetrics.overdue)} sub={tt('срок прошёл')} color="#DC2626" />
          <Tile label={tt('Выполнено сегодня')} value={fmtNum(mineMetrics.done_today)} sub={tt('закрыто за день')} color="#16A34A" />
          <Tile label={tt('Новых')} value={fmtNum(mineMetrics.unread)} sub={tt('ещё не просмотрено')} color="#D97706" />
        </div>

        {selfOpen && (
          <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div className="grid-3" style={{ gap: 10 }}>
              <div>
                <label style={lbl}>{tt('Что сделать')}</label>
                <input className="input" value={selfTitle} placeholder={tt('Например: свести кассу за неделю')}
                  onChange={e => setSelfTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitSelf(); }} />
              </div>
              <div>
                <label style={lbl}>{tt('Приоритет')}</label>
                <select className="input" value={selfPrio} onChange={e => setSelfPrio(e.target.value)}>
                  {PRIORITY_ORDER.map(k => <option key={k} value={k}>{pickLabel(PRIORITY_META[k], uz)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Срок')}</label>
                <input className="input" type="date" value={selfDue} onChange={e => setSelfDue(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={selfSaving || !selfTitle.trim()} onClick={submitSelf}>
                {selfSaving ? tt('Сохранение…') : tt('Добавить')}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={selfSaving}
                onClick={() => { setSelfOpen(false); setSelfTitle(''); setSelfDue(''); }}>
                {tt('Отмена')}
              </button>
            </div>
          </div>
        )}

        {mineErr && <div style={errText}>{mineErr}</div>}

        {mineLoading && !mine ? (
          <Skeleton height={160} />
        ) : mineItems.length === 0 ? (
          <EmptyState title={tt('Дел нет')}
            description={tt('Задачи от руководителя появятся здесь сразу после назначения.')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mineItems.map(t => {
              const prio = PRIORITY_META[t.priority] || PRIORITY_META.medium;
              const st = STATUS_META[t.status] || STATUS_META.todo;
              const fromBoss = t.created_by != null && t.created_by !== myId;
              const open = histId === t.id;
              return (
                <div key={t.id} style={{
                  border: '1px solid var(--border)', borderLeft: `4px solid ${prio.color}`,
                  borderRadius: 10, padding: 12, background: t.unread ? '#F5F9FF' : 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {t.unread && <Badge tone="blue">{tt('Новая')}</Badge>}
                    <Badge tone={st.tone}>{pickLabel(st, uz)}</Badge>
                    <Badge tone={prio.tone}>{pickLabel(prio, uz)}</Badge>
                    {t.overdue && <Badge tone="red">{tt('Просрочено')}</Badge>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{t.title}</div>
                  {t.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{t.description}</div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fromBoss
                      ? `${tt('Поручил')}: ${t.creator_name || '—'}`
                      : tt('Личное дело')}</span>
                    {t.due_date && <span style={{ color: t.overdue ? '#DC2626' : 'var(--text3)', fontWeight: 700 }}>{fmtDue(t, uz)}</span>}
                    {t.branch_name && <span>{t.branch_name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {t.status === 'todo' && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyId === t.id}
                        onClick={() => setMyStatus(t, 'in_progress')}>{tt('Взять в работу')}</button>
                    )}
                    {t.status !== 'done' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === t.id}
                        onClick={() => setMyStatus(t, 'done')}>{tt('Готово')}</button>
                    )}
                    {t.status === 'done' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === t.id}
                        onClick={() => setMyStatus(t, 'in_progress')}>{tt('Вернуть в работу')}</button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                      onClick={() => setHistId(open ? null : t.id)}>
                      {open ? tt('Скрыть историю') : tt('История')}
                    </button>
                  </div>
                  {open && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      {histLoading && hist.length === 0 ? (
                        <Skeleton height={54} />
                      ) : hist.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tt('Событий пока нет')}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {hist.map(ev => {
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ═══ 2. Поручения ═══ */}
      <Card title={tt('Поручения')} style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
          {tt('Задачи, которые вы поставили команде. Перетащите карточку между колонками, чтобы сменить статус — исполнитель увидит это у себя.')}
        </div>
        {/* compact: плитки доски продублировали бы метрики блока «Мои дела» */}
        <TaskBoard scope="by_me" branchId={branchId} compact onChanged={reloadMine} />
      </Card>

      {/* ═══ 3. Зарплаты ═══ */}
      <Card
        title={tt('Зарплаты')}
        style={{ marginBottom: 18 }}
        actions={hrLinks.salaries ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/hr/salaries')}>
            {tt('Открыть ФОТ')}
          </button>
        ) : null}>
        <div style={{ marginBottom: 14 }}>
          <Pills value={salPeriod} onChange={setSalPeriod} label="Период"
            options={lastMonths(6).map(p => ({ value: p, label: p }))} />
        </div>

        {salErr ? (
          <div style={errText}>{salErr}</div>
        ) : salLoading && !sal ? (
          <Skeleton height={120} />
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: 14 }}>
              <Tile label={tt('Всего к выплате')} value={fmtMoneyFull(salSum.total)} sub={tt('сум')} color="#1D4ED8" />
              <Tile label={tt('Оклады')} value={fmtMoneyFull(salSum.base)} sub={tt('сум · фикс')} color="#0EA5E9" />
              <Tile label={tt('% с продаж')} value={fmtMoneyFull(salSum.commission)} sub={tt('сум · комиссии')} color="#16A34A" />
              {/* «Удержания в ведомости» ≠ «Штрафы за период» ниже: это разные
                  источники (salaries.penalty против employee_adjustments). */}
              <Tile label={tt('Удержания в ведомости')} value={fmtMoneyFull(salSum.penalty)} sub={tt('сум · вычтено')} color="#DC2626" />
            </div>

            {salRows.length === 0 ? (
              <EmptyState title={tt('Нет данных по ведомости')}
                description={tt('За выбранный месяц начислений не найдено.')} />
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Роль')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('К выплате')}</th>
                      <th>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salRows.map(r => {
                      const stat = SAL_STATUS[r.status] || SAL_STATUS.draft;
                      return (
                        <tr key={r.employee_id}>
                          <td style={{ fontWeight: 700 }}>{r.name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{pickLabel(ROLE_LABELS[r.role], uz) || r.role}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.total)}</td>
                          <td><Badge tone={stat.tone}>{tt(stat.ru)}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('Только просмотр. Утверждение и выплата — в разделе «Зарплата (ФОТ)».')}
            </div>
          </>
        )}
      </Card>

      {/* ═══ 4. Нарушения ═══ */}
      <Card
        title={tt('Нарушения')}
        actions={hrLinks.adjustments ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/hr/hr-adjustments')}>
            {tt('Открыть штрафы и бонусы')}
          </button>
        ) : null}>
        <div style={{ marginBottom: 14 }}>
          <Pills value={adjPeriod} onChange={setAdjPeriod} label="Период"
            options={ADJ_PERIODS.map(p => ({ value: p.value, label: tt(p.ru) }))} />
        </div>

        {adjErr ? (
          <div style={errText}>{adjErr}</div>
        ) : adjLoading && !adj ? (
          <Skeleton height={120} />
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: 14 }}>
              <Tile label={tt('Премии за период')} value={fmtMoneyFull(adjSum.bonus_total)} sub={tt('сум · начислено')} color="#16A34A" />
              <Tile label={tt('Штрафы за период')} value={fmtMoneyFull(adjSum.penalty_total)} sub={tt('сум · начислено')} color="#DC2626" />
              <Tile label={tt('Чистый эффект')} value={(adjSum.net >= 0 ? '+' : '') + fmtMoneyFull(adjSum.net)} sub={tt('премии − штрафы')}
                color={adjSum.net >= 0 ? '#16A34A' : '#DC2626'} />
              <Tile label={tt('Нарушений')} value={fmtNum(adjSum.violations)} sub={tt('всего за период')} color="#D97706" />
            </div>

            <div style={{ ...lbl, marginBottom: 8 }}>{tt('Кому стоит уделить внимание')}</div>
            {antiRating.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
                {tt('Нарушений за период нет.')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Штрафы (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Итого (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Нарушений')}</th>
                      <th>{tt('Дисциплина')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {antiRating.map(r => {
                      const lvl = disciplineLevel(r.violations, r.net);
                      return (
                        <tr key={r.employee_id}>
                          <td style={{ fontWeight: 700 }}>{r.employee_name || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', color: '#DC2626' }}>{fmtMoneyFull(r.penalty_total)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: r.net >= 0 ? '#16A34A' : '#DC2626' }}>
                            {(r.net >= 0 ? '+' : '') + fmtMoneyFull(r.net)}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.violations)}</td>
                          <td><Badge tone={lvl.tone}>{pickLabel(lvl, uz)}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={submitPenalty} style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 12 }}>
              <div style={{ ...lbl, marginBottom: 10 }}>{tt('Выдать штраф')}</div>
              <div className="grid-3" style={{ gap: 10 }}>
                <div>
                  <label style={lbl}>{tt('Сотрудник')}</label>
                  <select className="input" value={penEmp} onChange={e => setPenEmp(e.target.value)}>
                    <option value="">{tt('— выберите —')}</option>
                    {penEmployees.map(u => {
                      const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
                      const name = full || u.username || ('#' + u.id);
                      const r = pickLabel(ROLE_LABELS[u.role], uz);
                      return <option key={u.id} value={u.id}>{r ? `${name} · ${r}` : name}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{tt('Причина')}</label>
                  <select className="input" value={penCat} onChange={e => setPenCat(e.target.value)}>
                    {PENALTY_CATS.map(c => <option key={c.value} value={c.value}>{pickLabel(c, uz)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{tt('Сумма (сум)')}</label>
                  {/* Стейт строковый: округление только на blur — кламп в onChange
                      не давал бы стереть последнюю цифру. */}
                  <input className="input" inputMode="numeric" value={penAmount} placeholder="0"
                    onChange={e => setPenAmount(e.target.value.replace(/[^\d\s.,]/g, ''))}
                    onBlur={() => setPenAmount(v => {
                      const s = normalizeDecimal(v);
                      if (s === '') return '';
                      const n = Math.max(0, Math.round(parseFloat(s) || 0));
                      return String(n);
                    })} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>{tt('Примечание')}</label>
                <input className="input" value={penNote} placeholder={tt('необязательно')}
                  onChange={e => setPenNote(e.target.value)} />
              </div>
              {penErr && <div style={{ ...errText, marginTop: 10, marginBottom: 0 }}>{penErr}</div>}
              <div style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={penSaving}>
                  {penSaving ? tt('Сохранение…') : tt('Назначить штраф')}
                </button>
              </div>
            </form>
          </>
        )}
      </Card>
    </>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };
const errText = { color: '#DC2626', fontSize: 13, marginBottom: 10, fontWeight: 600 };
