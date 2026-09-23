'use strict';

const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { requireScreen } = require('../auth');
const { visibility, loadVisibleEvent, assertCanEdit } = require('../scope');
const { eventMoney, COST_CATEGORIES } = require('../money');
const { loadSettings, assertBranchInCompany } = require('../company');
const { instantiateStages, recomputeDeadlines, PROOF_LABELS, deadlineLabel } = require('../funnel');
const { todayIso } = require('../rental');
const v = require('../validate');

// Заказы на мероприятия: список, карточка, создание, правка, смена статуса.
// Позиции, оплаты, смета и бригада — в event-parts.js.

const STATUSES = ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

// Допустимые переходы. Завершённое можно вернуть в работу (ошибся при
// закрытии), отменённое — только в черновик: подтверждать заново осознанно.
const TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['draft', 'in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['draft'],
};

const EVENT_TYPES = ['Свадьба', 'Юбилей', 'Корпоратив', 'Помолвка', 'День рождения', 'Выпускной', 'Другое'];

// Завершённое и отменённое мероприятие заморожено: его деньги уже в отчётах, и
// тихая правка задним числом разошлась бы с тем, что видел владелец вчера.
function assertEditable(event) {
  if (event.status === 'completed' || event.status === 'cancelled') {
    throw new HttpError(409, `Мероприятие ${STATUS_LABELS[event.status].toLowerCase()} — сначала верните его в работу`);
  }
}

async function loadCard(q, user, event) {
  const [client, items, crew, payments, costLines, stages, reservations, settings] = await Promise.all([
    event.client_id
      ? q.query('SELECT id, name, phone, notes FROM ev_clients WHERE id = $1 AND company_id = $2', [event.client_id, user.company_id])
      : { rows: [] },
    q.query(`SELECT id, item_id, package_id, name, category, qty, price, cost
               FROM ev_event_items WHERE event_id = $1 ORDER BY id`, [event.id]),
    q.query(`SELECT id, user_id, user_name, role, pay_amount
               FROM ev_crew WHERE event_id = $1 ORDER BY id`, [event.id]),
    q.query(`SELECT id, amount, method, paid_at, note
               FROM ev_payments WHERE event_id = $1 ORDER BY paid_at, id`, [event.id]),
    q.query('SELECT category, planned, actual, note FROM ev_cost_lines WHERE event_id = $1', [event.id]),
    q.query(`SELECT id, position, name, responsible_role, proof_type, deadline_anchor, deadline_offset_hours,
                    due_at, status, checklist, submitted_at, reviewed_at, review_comment
               FROM ev_event_stages WHERE event_id = $1 ORDER BY position, id`, [event.id]),
    q.query(`SELECT r.id, r.item_id, i.name AS item_name, r.qty, r.date_from, r.date_to, r.status,
                    r.returned_qty, r.damaged_qty
               FROM ev_reservations r JOIN ev_items i ON i.id = r.item_id
              WHERE r.event_id = $1 ORDER BY r.id`, [event.id]),
    loadSettings(q, user.company_id),
  ]);

  const money = eventMoney({
    event,
    items: items.rows,
    crew: crew.rows,
    costLines: costLines.rows,
    payments: payments.rows,
    targetMarginPct: settings.target_margin_pct,
  });

  const now = Date.now();
  return {
    event: presentEvent(event),
    client: client.rows[0] || null,
    items: items.rows.map((it) => ({ ...it, sum: Math.round(Number(it.qty) * Number(it.price) * 100) / 100 })),
    crew: crew.rows,
    payments: payments.rows,
    stages: stages.rows.map((s) => ({
      ...s,
      proof_label: PROOF_LABELS[s.proof_type],
      deadline_label: deadlineLabel(s.deadline_anchor, s.deadline_offset_hours),
      overdue: s.status !== 'accepted' && s.due_at && new Date(s.due_at).getTime() < now,
    })),
    reservations: reservations.rows,
    money,
  };
}

function presentEvent(e) {
  return {
    id: e.id,
    title: e.title,
    event_type: e.event_type,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    venue: e.venue,
    address: e.address,
    client_id: e.client_id,
    branch_id: e.branch_id,
    status: e.status,
    status_label: STATUS_LABELS[e.status],
    next_statuses: TRANSITIONS[e.status] || [],
    total_price: Number(e.total_price),
    notes: e.notes,
    created_at: e.created_at,
    updated_at: e.updated_at,
    closed_at: e.closed_at,
  };
}

// Клиент для нового мероприятия: либо существующий из этой компании, либо новый
// (имя + телефон прямо в форме заказа — так заказы и заводят на деле).
async function resolveClient(t, user, body) {
  const clientId = v.id(body.client_id, { field: 'Клиент' });
  if (clientId) {
    const { rows: [c] } = await t.query(
      'SELECT id FROM ev_clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [clientId, user.company_id]);
    if (!c) throw new HttpError(400, 'Клиент не найден');
    return c.id;
  }
  if (body.client && typeof body.client === 'object') {
    const name = v.text(body.client.name, { field: 'Имя клиента', max: 200 });
    if (!name) return null;
    const phone = v.text(body.client.phone, { field: 'Телефон клиента', max: 40 });
    const { rows: [c] } = await t.query(
      'INSERT INTO ev_clients (company_id, name, phone, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [user.company_id, name, phone || null, user.id]);
    return c.id;
  }
  return clientId === null ? null : undefined;
}

// Филиал мероприятия. Координатор с филиалом создаёт только в своём — иначе он
// завёл бы мероприятие, которое сам потом не увидит.
async function resolveBranch(identity, user, raw) {
  if (user.role === 'coordinator' && user.branch_id) return user.branch_id;
  const branchId = v.id(raw, { field: 'Филиал' });
  if (branchId) await assertBranchInCompany(identity, user.company_id, branchId);
  return branchId === undefined ? null : branchId;
}

function eventsRouter({ db, identity }) {
  const r = express.Router();
  r.use(requireScreen('order'));

  r.get('/meta', asyncHandler(async (req, res) => {
    res.json({ statuses: STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s] })), event_types: EVENT_TYPES });
  }));

  r.get('/', asyncHandler(async (req, res) => {
    const vis = visibility(req.user, 'e', 1);
    const params = [...vis.params];
    const where = [vis.sql];

    const status = req.query.status;
    if (status === 'active') {
      where.push(`e.status IN ('draft', 'confirmed', 'in_progress')`);
    } else if (status) {
      v.oneOf(status, STATUSES, { field: 'Статус' });
      params.push(status);
      where.push(`e.status = $${params.length}`);
    }
    // Даты фильтра — календарные дни по Ташкенту, а не по часовому поясу сервера.
    const from = v.date(req.query.from, { field: 'С' });
    const to = v.date(req.query.to, { field: 'По' });
    if (from) { params.push(from); where.push(`(e.starts_at AT TIME ZONE 'Asia/Tashkent')::date >= $${params.length}::date`); }
    if (to) { params.push(to); where.push(`(e.starts_at AT TIME ZONE 'Asia/Tashkent')::date <= $${params.length}::date`); }
    const search = v.text(req.query.q, { field: 'Поиск', max: 100 });
    if (search) {
      params.push(`%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      where.push(`(e.title ILIKE $${params.length} OR e.venue ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }

    const { rows } = await db.query(
      `SELECT e.*, c.name AS client_name, c.phone AS client_phone,
              COALESCE(p.paid, 0) AS paid,
              COALESCE(cr.crew_count, 0)::int AS crew_count
         FROM ev_events e
         LEFT JOIN ev_clients c ON c.id = e.client_id
         LEFT JOIN (SELECT event_id, SUM(amount) AS paid FROM ev_payments GROUP BY event_id) p ON p.event_id = e.id
         LEFT JOIN (SELECT event_id, COUNT(*) AS crew_count FROM ev_crew GROUP BY event_id) cr ON cr.event_id = e.id
        WHERE ${where.join(' AND ')}
        ORDER BY e.starts_at DESC, e.id DESC
        LIMIT 500`, params);

    res.json({
      items: rows.map((e) => {
        const total = Number(e.total_price);
        const paid = Number(e.paid);
        return {
          ...presentEvent(e),
          client: e.client_id ? { id: e.client_id, name: e.client_name, phone: e.client_phone } : null,
          paid,
          remaining: Math.round((total - paid) * 100) / 100,
          crew_count: e.crew_count,
        };
      }),
    });
  }));

  r.post('/', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const b = req.body || {};
    const title = v.text(b.title, { field: 'Название', required: true, max: 200 });
    const eventType = v.text(b.event_type, { field: 'Тип', max: 60 }) || 'Свадьба';
    const startsAt = v.moment(b.starts_at, { field: 'Начало', required: true });
    const endsAt = v.moment(b.ends_at, { field: 'Окончание' });
    if (endsAt && new Date(endsAt) < new Date(startsAt)) throw new HttpError(400, 'Окончание раньше начала');
    const totalPrice = v.amount(b.total_price, { field: 'Стоимость' }) ?? 0;
    const branchId = await resolveBranch(identity, req.user, b.branch_id);

    const card = await db.tx(async (t) => {
      const clientId = await resolveClient(t, req.user, b);
      const { rows: [event] } = await t.query(
        `INSERT INTO ev_events
           (company_id, branch_id, title, event_type, starts_at, ends_at, venue, address,
            client_id, total_price, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [req.user.company_id, branchId, title, eventType, startsAt, endsAt || null,
          v.text(b.venue, { field: 'Площадка', max: 200 }) || null,
          v.text(b.address, { field: 'Адрес', max: 300 }) || null,
          clientId || null, totalPrice,
          v.text(b.notes, { field: 'Заметки', max: 4000 }) || null,
          req.user.id]);
      await instantiateStages(t, event);
      return loadCard(t, req.user, event);
    });
    res.status(201).json(card);
  }));

  r.get('/:id', asyncHandler(async (req, res) => {
    const event = await loadVisibleEvent(db, req.user, req.params.id);
    res.json(await loadCard(db, req.user, event));
  }));

  r.put('/:id', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const b = req.body || {};
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      assertEditable(event);

      const sets = [];
      const params = [event.id];
      const put = (col, val) => {
        if (val === undefined) return;
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };
      if (b.title !== undefined) put('title', v.text(b.title, { field: 'Название', required: true, max: 200 }));
      if (b.event_type !== undefined) put('event_type', v.text(b.event_type, { field: 'Тип', required: true, max: 60 }));
      const startsAt = v.moment(b.starts_at, { field: 'Начало' });
      if (startsAt === null) throw new HttpError(400, 'Дата начала обязательна');
      put('starts_at', startsAt);
      put('ends_at', v.moment(b.ends_at, { field: 'Окончание' }));
      put('venue', v.text(b.venue, { field: 'Площадка', max: 200 }));
      put('address', v.text(b.address, { field: 'Адрес', max: 300 }));
      put('notes', v.text(b.notes, { field: 'Заметки', max: 4000 }));
      put('total_price', v.amount(b.total_price, { field: 'Стоимость' }));
      if (b.client_id !== undefined || b.client !== undefined) put('client_id', await resolveClient(t, req.user, b) ?? null);
      if (b.branch_id !== undefined) put('branch_id', await resolveBranch(identity, req.user, b.branch_id));
      if (!sets.length) return loadCard(t, req.user, event);

      const { rows: [updated] } = await t.query(
        `UPDATE ev_events SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, params);
      if (updated.ends_at && new Date(updated.ends_at) < new Date(updated.starts_at)) {
        throw new HttpError(400, 'Окончание раньше начала');
      }
      if (startsAt !== undefined || b.ends_at !== undefined) await recomputeDeadlines(t, updated);
      return loadCard(t, req.user, updated);
    });
    res.json(card);
  }));

  r.post('/:id/status', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const next = v.oneOf(req.body && req.body.status, STATUSES, { field: 'Статус', required: true });
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      if (!(TRANSITIONS[event.status] || []).includes(next)) {
        throw new HttpError(409, `Нельзя перевести из «${STATUS_LABELS[event.status]}» в «${STATUS_LABELS[next]}»`);
      }
      // Подтверждённый заказ без цены — это договор ни о чём: деньги по нему не
      // посчитать, а предоплату не с чего вычесть.
      if (next === 'confirmed' && !(Number(event.total_price) > 0)) {
        throw new HttpError(409, 'Перед подтверждением укажите стоимость мероприятия');
      }
      // Вернуть завершённое в работу может только руководитель: это правка
      // уже закрытых денег.
      if (event.status === 'completed' && !['founder', 'project_manager'].includes(req.user.role)) {
        throw new HttpError(403, 'Вернуть завершённое мероприятие может только руководитель');
      }
      const { rows: [updated] } = await t.query(
        `UPDATE ev_events
            SET status = $2,
                closed_at = CASE WHEN $2 = 'completed' THEN now() WHEN $2 = 'in_progress' THEN NULL ELSE closed_at END,
                updated_at = now()
          WHERE id = $1 RETURNING *`, [event.id, next]);
      // Отмена освобождает прокат: иначе вещи числились бы занятыми под
      // мероприятие, которого не будет, и склад показывал бы ложный дефицит.
      if (next === 'cancelled') {
        await t.query(
          `UPDATE ev_reservations SET status = 'cancelled' WHERE event_id = $1 AND status = 'reserved'`, [event.id]);
      }
      return loadCard(t, req.user, updated);
    });
    res.json(card);
  }));

  r.delete('/:id', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      if (!['draft', 'cancelled'].includes(event.status)) {
        throw new HttpError(409, 'Удалить можно только черновик или отменённое мероприятие');
      }
      const { rows: [pay] } = await t.query('SELECT COUNT(*)::int AS n FROM ev_payments WHERE event_id = $1', [event.id]);
      if (pay.n > 0) throw new HttpError(409, 'По мероприятию есть оплаты — удалить нельзя, только отменить');
      await t.query(`UPDATE ev_reservations SET status = 'cancelled' WHERE event_id = $1 AND status = 'reserved'`, [event.id]);
      await t.query('UPDATE ev_events SET deleted_at = now(), updated_at = now() WHERE id = $1', [event.id]);
    });
    res.json({ ok: true });
  }));

  return r;
}

module.exports = {
  eventsRouter, loadCard, assertEditable, presentEvent,
  STATUSES, STATUS_LABELS, TRANSITIONS, EVENT_TYPES, COST_CATEGORIES, todayIso,
};
