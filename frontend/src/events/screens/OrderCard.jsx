import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import eventsApi, { errorText } from '../api.js';
import { EDITOR_ROLES, ROLE_LABELS, STATUS_ACTIONS } from '../access.js';
import { money, percent, dateTime, date, parseAmount } from '../format.js';
import { Card, StatusBadge, Badge, Empty, Loading, ErrorAlert, Button, Field, AmountInput, Modal } from '../ui.jsx';
import { EventsContext } from '../EventsShell.jsx';
import OrderForm from './OrderForm.jsx';

const CATEGORY_LABELS = { rental: 'Прокат', consumable: 'Расходник' };
const METHOD_LABELS = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод' };
const PAYMENT_TONE = { paid: 'good', partial: 'warn', unpaid: 'bad', overpaid: 'warn', no_price: 'muted' };
const MARGIN_TONE = { ok: 'good', below_target: 'warn', loss: 'bad', unknown: 'muted' };
const MARGIN_LABEL = { ok: 'в норме', below_target: 'ниже целевой', loss: 'убыток', unknown: 'нет цены' };

// Карточка заказа. Каждое изменение возвращает с сервера карточку ЦЕЛИКОМ —
// поэтому деньги, смета и прибыль во всех блоках всегда из одного ответа.
export default function OrderCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useContext(EventsContext);
  const role = me.user.role;
  const canEdit = EDITOR_ROLES.includes(role);
  const isLead = role === 'founder' || role === 'project_manager';

  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    setError('');
    eventsApi.get(`/events/${id}`)
      .then(({ data }) => setCard(data))
      .catch((e) => setError(e.response?.status === 404 ? 'Заказ не найден или у вас нет к нему доступа' : errorText(e)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Общая обёртка для действий: блокирует кнопки, показывает ошибку сервера,
  // кладёт в состояние свежую карточку.
  const act = useCallback(async (fn) => {
    setActionError('');
    setBusy(true);
    try {
      const { data } = await fn();
      if (data && data.event) setCard(data);
      return true;
    } catch (e) {
      setActionError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  if (error) {
    return (
      <>
        <ErrorAlert>{error}</ErrorAlert>
        <div style={{ marginTop: 12 }}><Link to="/events/orders">← К списку заказов</Link></div>
      </>
    );
  }
  if (!card) return <Loading />;

  const { event: ev, money: m } = card;
  const frozen = ev.status === 'completed' || ev.status === 'cancelled';
  const editable = canEdit && !frozen;

  async function removeEvent() {
    const ok = await act(() => eventsApi.delete(`/events/${ev.id}`));
    if (ok) navigate('/events/orders');
  }

  return (
    <>
      <div style={{ marginBottom: 8 }}><Link to="/events/orders" className="ev-muted">← Заказы</Link></div>
      <div className="ev-page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ev-page-title" style={{ overflowWrap: 'anywhere' }}>{ev.title}</h1>
          <div className="ev-page-sub" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={ev.status} />
            <span>{dateTime(ev.starts_at)}</span>
            <span>· {ev.event_type}</span>
          </div>
        </div>
        {canEdit && (
          <div className="ev-toolbar">
            {ev.next_statuses
              .filter((s) => !(ev.status === 'completed' && !isLead))
              .map((s) => (
                <Button
                  key={s}
                  variant={{ cancelled: 'danger', draft: 'ghost' }[s] || 'primary'}
                  disabled={busy}
                  onClick={() => act(() => eventsApi.post(`/events/${ev.id}/status`, { status: s }))}
                >
                  {STATUS_ACTIONS[s] || s}
                </Button>
              ))}
            {!frozen && <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)}>Изменить</Button>}
            {['draft', 'cancelled'].includes(ev.status) && (
              <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Удалить</Button>
            )}
          </div>
        )}
      </div>

      <ErrorAlert>{actionError}</ErrorAlert>
      {frozen && (
        <div className="ev-alert ev-alert-info" style={{ marginBottom: 16 }}>
          {ev.status === 'completed'
            ? 'Мероприятие завершено: состав и цена заморожены. Оплаты и фактические расходы вносить можно.'
            : 'Мероприятие отменено: изменения закрыты. Верните его в черновик, чтобы продолжить работу.'}
        </div>
      )}

      <div className="ev-grid ev-grid-main" style={{ marginTop: 8 }}>
        <div className="ev-grid">
          <EventInfo card={card} />
          <DecorSection card={card} editable={editable} busy={busy} act={act} />
          <CrewSection card={card} editable={editable} busy={busy} act={act} />
          <StagesSection card={card} />
        </div>
        <div className="ev-grid">
          <MoneySection card={card} canPay={canEdit && ev.status !== 'cancelled'} canDelete={isLead} busy={busy} act={act} />
          <ProfitSection card={card} canEdit={canEdit && ev.status !== 'cancelled'} busy={busy} act={act} />
        </div>
      </div>

      {editing && (
        <OrderForm initial={card} onClose={() => setEditing(false)} onSaved={(data) => setCard(data)} />
      )}
      {confirmDelete && (
        <Modal
          title="Удалить заказ?"
          onClose={() => setConfirmDelete(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Отмена</Button>
              <Button variant="danger" disabled={busy} onClick={removeEvent}>Удалить</Button>
            </>
          )}
        >
          <p style={{ margin: 0 }}>«{ev.title}» пропадёт из списков. Заказ с оплатами удалить нельзя — его можно только отменить.</p>
        </Modal>
      )}
    </>
  );
}

function EventInfo({ card }) {
  const { event: ev, client } = card;
  return (
    <Card title="Событие">
      <div className="ev-facts">
        <Fact label="Начало" value={dateTime(ev.starts_at)} />
        <Fact label="Окончание" value={ev.ends_at ? dateTime(ev.ends_at) : '—'} />
        <Fact label="Тип" value={ev.event_type} />
        <Fact label="Площадка" value={ev.venue || '—'} />
        <Fact label="Адрес" value={ev.address || '—'} />
        <Fact label="Клиент" value={client ? client.name : '—'} />
        {client?.phone && <Fact label="Телефон" value={<a href={`tel:${client.phone.replace(/[^+\d]/g, '')}`}>{client.phone}</a>} />}
      </div>
      {ev.notes && <p className="ev-muted" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{ev.notes}</p>}
    </Card>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <div className="ev-fact-label">{label}</div>
      <div className="ev-fact-value">{value}</div>
    </div>
  );
}

function DecorSection({ card, editable, busy, act }) {
  const { event: ev, items, money: m } = card;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('rental');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [formError, setFormError] = useState('');

  async function add(e) {
    e.preventDefault();
    setFormError('');
    const q = parseAmount(qty);
    const p = price.trim() === '' ? 0 : parseAmount(price);
    const c = cost.trim() === '' ? 0 : parseAmount(cost);
    if (!name.trim()) { setFormError('Укажите наименование'); return; }
    if (!q || q <= 0) { setFormError('Количество должно быть больше нуля'); return; }
    if (p === null || c === null) { setFormError('Цена и себестоимость — числа'); return; }
    const ok = await act(() => eventsApi.post(`/events/${ev.id}/items`, { name: name.trim(), category, qty: q, price: p, cost: c }));
    if (ok) { setName(''); setQty('1'); setPrice(''); setCost(''); }
  }

  return (
    <Card title="Декор" extra={<small>итого по декору {money(m.cost.decorTotal)}</small>}>
      {items.length === 0 ? (
        <Empty>{editable ? 'Добавьте позиции декора — прокат и расходники.' : 'Позиций декора нет.'}</Empty>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Наименование</th><th className="ev-hide-sm">Категория</th><th className="ev-num ev-hide-sm">Кол-во</th>
                <th className="ev-num ev-hide-sm">Цена</th><th className="ev-num">Сумма</th>{editable && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    {/* На телефоне скрытые колонки — одной строкой под названием. */}
                    <div className="ev-show-sm ev-muted" style={{ fontSize: 12 }}>
                      {CATEGORY_LABELS[it.category]} · {Number(it.qty).toLocaleString('ru-RU')} × {money(it.price)}
                    </div>
                  </td>
                  <td className="ev-hide-sm"><Badge tone={it.category === 'rental' ? undefined : 'muted'}>{CATEGORY_LABELS[it.category]}</Badge></td>
                  <td className="ev-num ev-hide-sm">{Number(it.qty).toLocaleString('ru-RU')}</td>
                  <td className="ev-num ev-hide-sm">{money(it.price)}</td>
                  <td className="ev-num" style={{ fontWeight: 700 }}>{money(it.sum)}</td>
                  {editable && (
                    <td className="ev-num">
                      <button
                        type="button"
                        className="ev-btn-link"
                        style={{ color: 'var(--ev-bad)' }}
                        disabled={busy}
                        onClick={() => act(() => eventsApi.delete(`/events/${ev.id}/items/${it.id}`))}
                      >
                        Убрать
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <form onSubmit={add} style={{ marginTop: 14 }}>
          <div className="ev-inline-form">
            <Field label="Наименование">
              <input className="ev-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Арка из живых цветов" maxLength={200} />
            </Field>
            <Field label="Категория">
              <select className="ev-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="rental">Прокат</option>
                <option value="consumable">Расходник</option>
              </select>
            </Field>
            <Field label="Кол-во"><AmountInput value={qty} onChange={setQty} /></Field>
            <Field label="Цена за ед."><AmountInput value={price} onChange={setPrice} placeholder="0" /></Field>
            <Button type="submit" disabled={busy}>Добавить</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginTop: 8, flexWrap: 'wrap' }}>
            <Field
              label={category === 'rental' ? 'Амортизация за выдачу' : 'Себестоимость за ед.'}
              hint="Идёт в смету: материалы или амортизация проката"
            >
              <AmountInput value={cost} onChange={setCost} placeholder="0" style={{ maxWidth: 200 }} />
            </Field>
          </div>
          <ErrorAlert>{formError}</ErrorAlert>
        </form>
      )}
    </Card>
  );
}

function MoneySection({ card, canPay, canDelete, busy, act }) {
  const { event: ev, payments, money: m } = card;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [formError, setFormError] = useState('');
  const paidPct = m.revenue > 0 ? Math.min(100, Math.round((m.paid / m.revenue) * 100)) : 0;

  async function pay(e) {
    e.preventDefault();
    setFormError('');
    const a = parseAmount(amount);
    if (!a || a <= 0) { setFormError('Сумма должна быть больше нуля'); return; }
    const ok = await act(() => eventsApi.post(`/events/${ev.id}/payments`, { amount: a, method }));
    if (ok) setAmount('');
  }

  return (
    <Card title="Деньги" extra={<Badge tone={PAYMENT_TONE[m.payment_status]}>{m.payment_label}</Badge>}>
      <div className="ev-money-row"><span>Полная стоимость</span><span className="ev-num">{money(m.revenue)}</span></div>
      <div className="ev-money-row"><span>Оплачено</span><span className="ev-num ev-good">{money(m.paid)}</span></div>
      <div className="ev-money-row is-total">
        <span>Остаток</span>
        <span className={`ev-num ${m.remaining > 0 ? 'ev-warn' : ''}`}>{money(m.remaining)}</span>
      </div>
      {m.revenue > 0 && <div className="ev-bar" style={{ margin: '8px 0 4px' }}><span style={{ width: `${paidPct}%` }} /></div>}

      {payments.length > 0 && (
        <div className="ev-list" style={{ marginTop: 10 }}>
          {payments.map((p) => (
            <div key={p.id} className="ev-list-row">
              <div className="ev-list-main">
                <div className="ev-list-title">{money(p.amount)}</div>
                <div className="ev-list-sub">{[METHOD_LABELS[p.method], date(p.paid_at), p.note].filter(Boolean).join(' · ')}</div>
              </div>
              {canDelete && (
                <button
                  type="button"
                  className="ev-btn-link"
                  style={{ color: 'var(--ev-bad)' }}
                  disabled={busy}
                  onClick={() => act(() => eventsApi.delete(`/events/${ev.id}/payments/${p.id}`))}
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canPay && (
        <form onSubmit={pay} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="Принять оплату" className="" >
            <AmountInput
              value={amount}
              onChange={setAmount}
              placeholder={m.remaining > 0 ? Math.round(m.remaining).toLocaleString('ru-RU').replace(/ /g, ' ') : '0'}
              style={{ maxWidth: 170 }}
            />
          </Field>
          <Field label="Способ">
            <select className="ev-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
              <option value="transfer">Перевод</option>
            </select>
          </Field>
          <Button type="submit" disabled={busy}>Принять</Button>
          <div style={{ flexBasis: '100%' }}><ErrorAlert>{formError}</ErrorAlert></div>
        </form>
      )}
    </Card>
  );
}

function ProfitSection({ card, canEdit, busy, act }) {
  const { event: ev, money: m } = card;
  const [open, setOpen] = useState(false);
  const rows = m.cost.rows;

  return (
    <Card title="Прибыль по событию" extra={<Badge tone={MARGIN_TONE[m.margin_status]}>{MARGIN_LABEL[m.margin_status]}</Badge>}>
      <div className="ev-money-row"><span>Цена</span><span className="ev-num">{money(m.revenue)}</span></div>
      <div className="ev-money-row"><span>Себестоимость</span><span className="ev-num">− {money(m.cost.cost_total)}</span></div>
      <div className="ev-money-row is-total">
        <span>Прибыль</span>
        <span className={`ev-num ${m.profit < 0 ? 'ev-bad' : 'ev-good'}`}>{money(m.profit)}</span>
      </div>
      <div className="ev-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Маржа {percent(m.margin_pct)} при целевой {percent(m.target_margin_pct)}
        {m.cost.fact_filled < 5 ? ` · факт внесён по ${m.cost.fact_filled} из 5 статей, остальное — по смете` : ' · всё по факту'}
      </div>

      <div className="ev-table-wrap">
        <table className="ev-table">
          <thead><tr><th>Статья</th><th className="ev-num">Смета</th><th className="ev-num">Факт</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td>
                  {r.label}
                  {r.planned_is_auto && r.planned > 0 && <div className="ev-muted" style={{ fontSize: 11 }}>смета из позиций</div>}
                </td>
                <td className="ev-num">{money(r.planned)}</td>
                <td className="ev-num">
                  {r.actual === null ? <span className="ev-muted">—</span> : (
                    <>
                      {money(r.actual)}
                      {r.delta !== 0 && (
                        <div style={{ fontSize: 11 }} className={r.delta > 0 ? 'ev-bad' : 'ev-good'}>{money(r.delta, { sign: true })}</div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div style={{ marginTop: 12 }}>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Внести смету и факт</Button>
        </div>
      )}
      {open && <CostLinesForm eventId={ev.id} rows={rows} busy={busy} act={act} onClose={() => setOpen(false)} />}
    </Card>
  );
}

// Смета и факт по пяти статьям. Пустое поле сметы = вернуть автосмету из
// позиций; пустое поле факта = факта ещё нет.
function CostLinesForm({ eventId, rows, busy, act, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(rows.map((r) => [r.category, {
    planned: r.planned_is_auto ? '' : String(r.planned),
    actual: r.actual === null ? '' : String(r.actual),
  }])));
  const [error, setError] = useState('');

  const set = (cat, field, v) => setValues((prev) => ({ ...prev, [cat]: { ...prev[cat], [field]: v } }));

  async function save() {
    setError('');
    const lines = [];
    for (const r of rows) {
      const v = values[r.category];
      const planned = v.planned.trim() === '' ? null : parseAmount(v.planned);
      const actual = v.actual.trim() === '' ? null : parseAmount(v.actual);
      if ((v.planned.trim() !== '' && planned === null) || (v.actual.trim() !== '' && actual === null)) {
        setError(`«${r.label}»: смета и факт — числа`);
        return;
      }
      lines.push({ category: r.category, planned, actual });
    }
    const ok = await act(() => eventsApi.put(`/events/${eventId}/cost-lines`, { lines }));
    if (ok) onClose();
  }

  return (
    <Modal
      title="Смета и факт"
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button disabled={busy} onClick={save}>Сохранить</Button>
        </>
      )}
    >
      <div className="ev-muted" style={{ fontSize: 13 }}>
        Пустая смета — считается сама из позиций декора и оплаты бригады. Факт вносите, когда расход известен.
      </div>
      {rows.map((r) => (
        <div key={r.category} className="ev-form-grid">
          <Field label={`${r.label} — смета`} hint={r.planned_is_auto ? `сейчас из позиций: ${money(r.planned)}` : undefined}>
            <AmountInput value={values[r.category].planned} onChange={(v) => set(r.category, 'planned', v)} placeholder="авто" />
          </Field>
          <Field label="факт">
            <AmountInput value={values[r.category].actual} onChange={(v) => set(r.category, 'actual', v)} placeholder="нет" />
          </Field>
        </div>
      ))}
      <ErrorAlert>{error}</ErrorAlert>
    </Modal>
  );
}

function CrewSection({ card, editable, busy, act }) {
  const { event: ev, crew } = card;
  const [staff, setStaff] = useState(null);
  const [userId, setUserId] = useState('');
  const [pay, setPay] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!editable) return;
    eventsApi.get('/staff').then(({ data }) => setStaff(data.items)).catch(() => setStaff([]));
  }, [editable]);

  const available = (staff || []).filter((s) => !crew.some((c) => c.user_id === s.id));
  const total = crew.reduce((s, c) => s + Number(c.pay_amount || 0), 0);

  async function add(e) {
    e.preventDefault();
    setFormError('');
    if (!userId) { setFormError('Выберите сотрудника'); return; }
    const p = pay.trim() === '' ? 0 : parseAmount(pay);
    if (p === null) { setFormError('Оплата — число'); return; }
    const ok = await act(() => eventsApi.post(`/events/${ev.id}/crew`, { user_id: Number(userId), pay_amount: p }));
    if (ok) { setUserId(''); setPay(''); }
  }

  return (
    <Card title="Бригада" extra={crew.length ? <small>оплата бригаде {money(total)}</small> : null}>
      {crew.length === 0 ? (
        <Empty>{editable ? 'Назначьте исполнителей — они увидят это мероприятие у себя.' : 'Бригада не назначена.'}</Empty>
      ) : (
        <div className="ev-list">
          {crew.map((c) => (
            <div key={c.id} className="ev-list-row">
              <div className="ev-stage-dot" aria-hidden="true">{c.user_name.slice(0, 1).toUpperCase()}</div>
              <div className="ev-list-main">
                <div className="ev-list-title">{c.user_name}</div>
                <div className="ev-list-sub">{ROLE_LABELS[c.role] || c.role}</div>
              </div>
              <div className="ev-num">{money(c.pay_amount)}</div>
              {editable && (
                <button
                  type="button"
                  className="ev-btn-link"
                  style={{ color: 'var(--ev-bad)' }}
                  disabled={busy}
                  onClick={() => act(() => eventsApi.delete(`/events/${ev.id}/crew/${c.id}`))}
                >
                  Убрать
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <form onSubmit={add} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="Сотрудник">
            <select className="ev-select" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">{staff === null ? 'Загружаю…' : (available.length ? 'Выберите' : 'Все уже в бригаде')}</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role_label}</option>)}
            </select>
          </Field>
          <Field label="Оплата за мероприятие">
            <AmountInput value={pay} onChange={setPay} placeholder="0" style={{ maxWidth: 170 }} />
          </Field>
          <Button type="submit" disabled={busy || !available.length}>Назначить</Button>
          <div style={{ flexBasis: '100%' }}><ErrorAlert>{formError}</ErrorAlert></div>
        </form>
      )}
    </Card>
  );
}

const STAGE_STATUS = {
  pending: ['Ожидает', 'muted'],
  submitted: ['На проверке', undefined],
  accepted: ['Принят', 'good'],
  returned: ['На доработке', 'warn'],
};

function StagesSection({ card }) {
  const { stages } = card;
  const accepted = stages.filter((s) => s.status === 'accepted').length;
  return (
    <Card title="Этапы работ" extra={<small>{accepted} из {stages.length} принято</small>}>
      {stages.length === 0 ? <Empty>Этапов нет.</Empty> : (
        <div>
          {stages.map((s) => {
            const [label, tone] = STAGE_STATUS[s.status] || [s.status];
            const cls = s.status === 'accepted' ? 'is-accepted' : s.overdue ? 'is-overdue' : s.status === 'submitted' ? 'is-submitted' : '';
            return (
              <div key={s.id} className={`ev-stage ${cls}`}>
                <div className="ev-stage-dot">{s.status === 'accepted' ? '✓' : s.position}</div>
                <div className="ev-list-main">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{s.name}</span>
                    <Badge tone={s.overdue ? 'bad' : tone}>{s.overdue ? 'Просрочен' : label}</Badge>
                  </div>
                  <div className="ev-list-sub">
                    {ROLE_LABELS[s.responsible_role] || s.responsible_role} · {s.deadline_label}
                    {s.due_at ? ` · до ${dateTime(s.due_at)}` : ''} · {s.proof_label}
                  </div>
                  {s.review_comment && s.status === 'returned' && (
                    <div className="ev-warn" style={{ fontSize: 12, marginTop: 2 }}>Замечание: {s.review_comment}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
