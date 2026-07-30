import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

const CATEGORY_META = {
  product_quality: { icon: '🛒', label: 'Качество товара' },
  staff_rudeness:  { icon: '👤', label: 'Грубость персонала' },
  slow_service:    { icon: '⏱️', label: 'Долгое обслуживание' },
  refund_delay:    { icon: '💰', label: 'Возврат денег' },
  wrong_price:     { icon: '🏷️', label: 'Неверная цена' },
  other:           { icon: '🏪', label: 'Другое' },
};

const CHANNEL_META = {
  in_store:  { icon: '🏬', label: 'В магазине' },
  instagram: { icon: '📸', label: 'Instagram' },
  telegram:  { icon: '✈️', label: 'Telegram' },
  phone:     { icon: '📞', label: 'Телефон' },
  email:     { icon: '✉️', label: 'Email' },
  website:   { icon: '🌐', label: 'Сайт' },
};

const STATUS_META = {
  new:         { badge: 'blue',   color: '#1D4ED8', label: 'Новая' },
  in_progress: { badge: 'yellow', color: '#D97706', label: 'В работе' },
  resolved:    { badge: 'green',  color: '#16A34A', label: 'Решено' },
  rejected:    { badge: 'gray',   color: '#6B7280', label: 'Отклонено' },
};

const COMPENSATION_META = {
  refund:      { label: 'Возврат денег' },
  replacement: { label: 'Замена товара' },
  discount:    { label: 'Скидка' },
  apology:     { label: 'Извинение' },
  none:        { label: 'Без компенсации' },
};

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const STATUS_TABS = [
  { value: 'all',         label: 'Все' },
  { value: 'new',         label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved',    label: 'Решено' },
  { value: 'rejected',    label: 'Отклонено' },
];

// Деньги вводим СТРОКОЙ: в onChange только чистка символов, округление — на blur.
// type="number" здесь недопустим: Chrome на промежуточно-невалидном вводе («1500,»)
// отдаёт e.target.value === '', и контролируемое поле само себя стирало —
// сумма компенсации уходила на сервер нулём.
const cleanMoney = (s) => String(s).replace(/[^\d.,]/g, '');
// Строка → целое число сум (>= 0). Мусор и пустое дают 0, NaN не возвращается никогда.
const moneyToNum = (s) => {
  const n = parseFloat(normalizeDecimal(s));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return Math.round(h * 60) + ' мин';
  if (h < 48) return (Math.round(h * 10) / 10) + ' ч';
  return Math.round(h / 24) + ' дн';
}

export default function ComplaintsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [status, setStatus] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    const params = { period };
    if (status !== 'all') params.status = status;
    if (branchId) params.branch_id = branchId;
    api.get('/crm/complaints', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [branchId, period, status]); // eslint-disable-line

  const summary = data?.summary || {};
  const byCategory = data?.byCategory || [];
  const items = data?.items || [];

  // --- Форма создания ---
  const [form, setForm] = useState({
    category: 'product_quality', channel: 'in_store',
    customer_name: '', customer_phone: '', description: '',
  });
  const submitCreate = () => {
    if (!form.description.trim()) { setError(tt('Опишите суть жалобы')); return; }
    setBusy(true);
    const body = { ...form };
    if (branchId) body.branch_id = branchId;
    api.post('/crm/complaints', body)
      .then(() => {
        setShowCreate(false);
        setForm({ category: 'product_quality', channel: 'in_store', customer_name: '', customer_phone: '', description: '' });
        load();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  // --- Форма решения ---
  const [rForm, setRForm] = useState({ resolution: '', compensation_type: 'none', compensation_amount: '', customer_satisfaction: '' });
  const openResolve = (c) => {
    setRForm({ resolution: '', compensation_type: 'none', compensation_amount: '', customer_satisfaction: '' });
    setResolveTarget(c);
  };
  // Границы и округление — только на blur. Пустое поле остаётся пустым (его можно
  // полностью очистить), мусор сбрасывается в пустоту, а не в NaN.
  const blurCompensation = () => setRForm(f => {
    if (f.compensation_amount === '') return f;
    const n = moneyToNum(f.compensation_amount);
    return { ...f, compensation_amount: n > 0 ? String(n) : '' };
  });
  const submitResolve = () => {
    if (!rForm.resolution.trim()) { setError(tt('Опишите решение')); return; }
    setBusy(true);
    const body = {
      resolution: rForm.resolution,
      compensation_type: rForm.compensation_type,
      compensation_amount: moneyToNum(rForm.compensation_amount),
    };
    if (rForm.customer_satisfaction) body.customer_satisfaction = rForm.customer_satisfaction;
    api.patch(`/crm/complaints/${resolveTarget.id}/resolve`, body)
      .then(() => { setResolveTarget(null); load(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const changeStatus = (c, next) => {
    setBusy(true);
    api.patch(`/crm/complaints/${c.id}/status`, { status: next })
      .then(load)
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

  return (
    <>
      <PageHeader
        title={tt('⚠️ Жалобы и обращения')}
        sub={tt('Единый тикетинг по всем каналам · авто-эскалация просроченных')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={summary.overdue > 0 ? 'red' : 'green'}>
              {summary.overdue > 0 ? `${summary.overdue} ${tt('просрочено')}` : tt('Нет просрочек')}
            </Badge>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{tt('+ Жалоба')}</button>
          </div>
        }
      />

      <div style={{ marginBottom: 14 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📨" label={tt('Получено')} value={fmtNum(summary.total)} sub={tt('за период')} color="#1D4ED8" />
            <Tile icon="✅" label={tt('Решено')}   value={fmtNum(summary.resolved)} sub={`${tt('ср. время')}: ${fmtHours(summary.avg_resolve_hours)}`} color="#16A34A" />
            <Tile icon="⏳" label={tt('В работе')}  value={fmtNum((summary.new || 0) + (summary.in_progress || 0))} sub={tt('новые + в работе')} color="#D97706" />
            <Tile icon="🔥" label={tt('Без ответа > 24ч')} value={fmtNum(summary.overdue)} sub={tt('срочная эскалация')} color="#DC2626" />
          </div>

          {byCategory.length > 0 && (
            <Card icon="📊" title={tt('По категориям')} style={{ marginBottom: 16 }}>
              <div className="list">
                {byCategory.map(c => {
                  const meta = CATEGORY_META[c.category] || { icon: '📌', label: c.category };
                  return (
                    <div key={c.category} className="list-item" style={{ alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="list-item-title">{tt(meta.label)}</div>
                        <div className="list-item-sub">{tt('Ср. время решения')}: {fmtHours(c.avg_resolve_hours)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }} className="mono">{c.count}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card icon="📋" title={`${tt('Жалобы')} (${items.length})`}
            actions={<Pills value={status} onChange={setStatus} options={STATUS_TABS.map(t => ({ ...t, label: tt(t.label) }))} />}>
            <div className="list">
              {items.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                  {tt('✓ Нет жалоб в этой выборке')}
                </div>
              ) : items.map(c => {
                const cat = CATEGORY_META[c.category] || { icon: '📌', label: c.category };
                const ch = CHANNEL_META[c.channel] || { icon: '📌', label: c.channel };
                const st = STATUS_META[c.status] || { badge: 'gray', color: '#6B7280', label: c.status };
                const open = c.status === 'new' || c.status === 'in_progress';
                return (
                  <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div style={{ width: 5, alignSelf: 'stretch', minHeight: 40, borderRadius: 3, background: c.urgency === 'urgent' ? '#DC2626' : st.color }} />
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: st.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="list-item-title">{tt(cat.label)}</div>
                        <Badge tone={st.badge}>{tt(st.label)}</Badge>
                        {c.urgency === 'urgent' && <Badge tone="red">{tt('СРОЧНО')}</Badge>}
                        <Badge tone="gray">{ch.icon} {tt(ch.label)}</Badge>
                        {c.branch_name && <Badge tone="gray">{c.branch_name}</Badge>}
                      </div>
                      <div className="list-item-sub" style={{ marginTop: 3 }}>{c.description}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                        {(c.customer_name || tt('Клиент не указан'))}{c.customer_phone ? ` · ${c.customer_phone}` : ''}
                        {c.employee_name ? ` · ${tt('сотрудник')}: ${c.employee_name}` : ''}
                        {' · '}{new Date(c.created_at).toLocaleDateString('ru-RU')}
                      </div>
                      {c.status === 'resolved' && c.resolution && (
                        <div style={{ marginTop: 6, padding: 8, background: 'rgba(22,163,74,.08)', borderRadius: 8, fontSize: 12, color: 'var(--text2)' }}>
                          ✅ {c.resolution}
                          {c.compensation_type && c.compensation_type !== 'none' && (
                            <span> · {tt(COMPENSATION_META[c.compensation_type]?.label || c.compensation_type)}
                              {c.compensation_amount > 0 ? ` (${fmtMoneyFull(c.compensation_amount)})` : ''}</span>
                          )}
                          {c.customer_satisfaction != null && <span> · {tt('оценка')} {c.customer_satisfaction}/5</span>}
                        </div>
                      )}
                    </div>
                    {open && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {c.status === 'new' && (
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus(c, 'in_progress')}>{tt('В работу')}</button>
                        )}
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => openResolve(c)}>{tt('Решить')}</button>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus(c, 'rejected')}>{tt('Отклонить')}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* === Модалка: создать жалобу === */}
      {showCreate && (
        <div style={overlay} onClick={() => !busy && setShowCreate(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новая жалоба')}</div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div>
                <label style={lbl}>{tt('Категория')}</label>
                <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Канал')}</label>
                <select style={inp} value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                  {Object.entries(CHANNEL_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Имя клиента')}</label>
                <input style={inp} value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder={tt('необязательно')} />
              </div>
              <div>
                <label style={lbl}>{tt('Телефон')}</label>
                <input style={inp} value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder={tt('необязательно')} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Описание')}</label>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tt('Суть жалобы')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setShowCreate(false)}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submitCreate}>{tt('Создать')}</button>
            </div>
          </div>
        </div>
      )}

      {/* === Модалка: решить жалобу === */}
      {resolveTarget && (
        <div style={overlay} onClick={() => !busy && setResolveTarget(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{tt('Решение жалобы')}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{resolveTarget.description}</div>
            <div>
              <label style={lbl}>{tt('Что сделали')}</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={rForm.resolution} onChange={e => setRForm({ ...rForm, resolution: e.target.value })} placeholder={tt('Описание решения')} />
            </div>
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>{tt('Компенсация')}</label>
                <select style={inp} value={rForm.compensation_type} onChange={e => setRForm({ ...rForm, compensation_type: e.target.value })}>
                  {Object.entries(COMPENSATION_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tt('Сумма компенсации')}</label>
                <input style={inp} type="text" inputMode="numeric" value={rForm.compensation_amount}
                  disabled={rForm.compensation_type !== 'refund' && rForm.compensation_type !== 'discount'}
                  onChange={e => setRForm({ ...rForm, compensation_amount: cleanMoney(e.target.value) })}
                  onBlur={blurCompensation} placeholder="0" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Оценка клиента (1–5)')}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button"
                    className={'btn btn-sm ' + (String(rForm.customer_satisfaction) === String(n) ? 'btn-primary' : 'btn-ghost')}
                    onClick={() => setRForm({ ...rForm, customer_satisfaction: n })}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setResolveTarget(null)}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submitResolve}>{tt('Решено')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modal = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };