'use strict';

const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { requireScreen } = require('../auth');
const { loadVisibleEvent, assertCanEdit } = require('../scope');
const { COST_CATEGORIES } = require('../money');
const { loadStaffMember } = require('../company');
const { loadCard, assertEditable } = require('./events');
const v = require('../validate');

// Составные части заказа: позиции декора, оплаты, смета/факт, бригада.
// Каждая ручка сначала загружает мероприятие через loadVisibleEvent — это и
// проверка владельца, и блокировка строки на время правки.

const CATEGORIES = ['rental', 'consumable'];
const PAY_METHODS = ['cash', 'card', 'transfer'];

function eventPartsRouter({ db, identity }) {
  const r = express.Router();
  r.use(requireScreen('order'));

  // Правка части заказа: мероприятие видно, не заморожено, пользователь — редактор.
  const withEditableEvent = (fn) => asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      assertEditable(event);
      await fn(t, req, event);
      const { rows: [fresh] } = await t.query(
        'UPDATE ev_events SET updated_at = now() WHERE id = $1 RETURNING *', [event.id]);
      return loadCard(t, req.user, fresh);
    });
    res.json(card);
  });

  // ── Позиции декора ─────────────────────────────────────────────────────────

  r.post('/:id/items', withEditableEvent(async (t, req, event) => {
    const b = req.body || {};
    const qty = v.amount(b.qty, { field: 'Количество', required: true, positive: true });
    const itemId = v.id(b.item_id, { field: 'Позиция каталога' });
    let snap;
    if (itemId) {
      // Из каталога: имя, категория, цена и себестоимость — снимком на сейчас.
      const { rows: [it] } = await t.query(
        `SELECT id, name, category, price, cost FROM ev_items
          WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`, [itemId, req.user.company_id]);
      if (!it) throw new HttpError(400, 'Позиция каталога не найдена');
      snap = {
        item_id: it.id,
        name: it.name,
        category: it.category,
        price: v.amount(b.price, { field: 'Цена' }) ?? Number(it.price),
        cost: v.amount(b.cost, { field: 'Себестоимость' }) ?? Number(it.cost),
      };
    } else {
      snap = {
        item_id: null,
        name: v.text(b.name, { field: 'Наименование', required: true, max: 200 }),
        category: v.oneOf(b.category, CATEGORIES, { field: 'Категория', required: true }),
        price: v.amount(b.price, { field: 'Цена' }) ?? 0,
        cost: v.amount(b.cost, { field: 'Себестоимость' }) ?? 0,
      };
    }
    await t.query(
      `INSERT INTO ev_event_items (company_id, event_id, item_id, name, category, qty, price, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user.company_id, event.id, snap.item_id, snap.name, snap.category, qty, snap.price, snap.cost]);
  }));

  r.put('/:id/items/:itemId', withEditableEvent(async (t, req, event) => {
    const b = req.body || {};
    const sets = [];
    const params = [v.id(req.params.itemId, { field: 'Позиция', required: true }), event.id];
    const put = (col, val) => {
      if (val === undefined) return;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    put('qty', v.amount(b.qty, { field: 'Количество', positive: true }));
    put('price', v.amount(b.price, { field: 'Цена' }));
    put('cost', v.amount(b.cost, { field: 'Себестоимость' }));
    if (b.name !== undefined) put('name', v.text(b.name, { field: 'Наименование', required: true, max: 200 }));
    if (!sets.length) return;
    // event_id в условии — позиция обязана принадлежать ЭТОМУ мероприятию.
    const { rowCount } = await t.query(
      `UPDATE ev_event_items SET ${sets.join(', ')} WHERE id = $1 AND event_id = $2`, params);
    if (!rowCount) throw new HttpError(404, 'Позиция не найдена');
  }));

  r.delete('/:id/items/:itemId', withEditableEvent(async (t, req, event) => {
    const itemId = v.id(req.params.itemId, { field: 'Позиция', required: true });
    const { rowCount } = await t.query('DELETE FROM ev_event_items WHERE id = $1 AND event_id = $2', [itemId, event.id]);
    if (!rowCount) throw new HttpError(404, 'Позиция не найдена');
  }));

  // ── Оплаты клиента ─────────────────────────────────────────────────────────
  // Оплату можно внести и по завершённому мероприятию (клиент доплатил после),
  // поэтому здесь своя проверка вместо withEditableEvent: запрещена только отмена.

  r.post('/:id/payments', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const b = req.body || {};
    const amountValue = v.amount(b.amount, { field: 'Сумма', required: true, positive: true });
    const method = v.oneOf(b.method, PAY_METHODS, { field: 'Способ оплаты' }) || 'cash';
    const paidAt = v.moment(b.paid_at, { field: 'Дата оплаты' });
    const note = v.text(b.note, { field: 'Комментарий', max: 500 });
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      if (event.status === 'cancelled') throw new HttpError(409, 'Мероприятие отменено — оплату не принять');
      await t.query(
        `INSERT INTO ev_payments (company_id, event_id, amount, method, paid_at, note, created_by)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7)`,
        [req.user.company_id, event.id, amountValue, method, paidAt || null, note || null, req.user.id]);
      return loadCard(t, req.user, event);
    });
    res.status(201).json(card);
  }));

  r.delete('/:id/payments/:paymentId', asyncHandler(async (req, res) => {
    // Удалить оплату — значит изменить уже полученные деньги: только руководитель.
    if (!['founder', 'project_manager'].includes(req.user.role)) {
      throw new HttpError(403, 'Удалить оплату может только руководитель');
    }
    const paymentId = v.id(req.params.paymentId, { field: 'Оплата', required: true });
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      const { rowCount } = await t.query('DELETE FROM ev_payments WHERE id = $1 AND event_id = $2', [paymentId, event.id]);
      if (!rowCount) throw new HttpError(404, 'Оплата не найдена');
      return loadCard(t, req.user, event);
    });
    res.json(card);
  }));

  // ── Смета и факт ───────────────────────────────────────────────────────────
  // Факт вносят и после завершения — чаще всего именно тогда он и известен.
  // Поэтому тоже без withEditableEvent: запрещена только отмена.

  r.put('/:id/cost-lines', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const lines = Array.isArray(req.body && req.body.lines) ? req.body.lines : null;
    if (!lines || !lines.length) throw new HttpError(400, 'Передайте строки сметы');
    const parsed = lines.map((l) => ({
      category: v.oneOf(l && l.category, COST_CATEGORIES, { field: 'Статья', required: true }),
      // null = вернуть автосмету / стереть факт; undefined = не трогать.
      planned: v.amount(l.planned, { field: 'Смета', nullable: true }),
      actual: v.amount(l.actual, { field: 'Факт', nullable: true }),
      note: v.text(l.note, { field: 'Комментарий', max: 300 }),
    }));
    const card = await db.tx(async (t) => {
      const event = await loadVisibleEvent(t, req.user, req.params.id, { forUpdate: true });
      if (event.status === 'cancelled') throw new HttpError(409, 'Мероприятие отменено — смету не менять');
      for (const l of parsed) {
        const { rows: [cur] } = await t.query(
          'SELECT planned, actual, note FROM ev_cost_lines WHERE event_id = $1 AND category = $2', [event.id, l.category]);
        const planned = l.planned === undefined ? (cur ? cur.planned : null) : l.planned;
        const actual = l.actual === undefined ? (cur ? cur.actual : null) : l.actual;
        const note = l.note === undefined ? (cur ? cur.note : null) : l.note;
        if (cur) {
          await t.query(
            `UPDATE ev_cost_lines SET planned = $3, actual = $4, note = $5, updated_at = now()
              WHERE event_id = $1 AND category = $2`, [event.id, l.category, planned, actual, note]);
        } else {
          await t.query(
            `INSERT INTO ev_cost_lines (company_id, event_id, category, planned, actual, note)
             VALUES ($1, $2, $3, $4, $5, $6)`, [req.user.company_id, event.id, l.category, planned, actual, note]);
        }
      }
      const { rows: [fresh] } = await t.query(
        'UPDATE ev_events SET updated_at = now() WHERE id = $1 RETURNING *', [event.id]);
      return loadCard(t, req.user, fresh);
    });
    res.json(card);
  }));

  // ── Бригада ────────────────────────────────────────────────────────────────
  // Список сотрудников для выбора — в routes/me.js (GET /api/events/staff).

  r.post('/:id/crew', withEditableEvent(async (t, req, event) => {
    const b = req.body || {};
    const userId = v.id(b.user_id, { field: 'Сотрудник', required: true });
    const member = await loadStaffMember(identity, req.user.company_id, userId);
    const pay = v.amount(b.pay_amount, { field: 'Оплата' }) ?? 0;
    const { rows: [dup] } = await t.query('SELECT id FROM ev_crew WHERE event_id = $1 AND user_id = $2', [event.id, userId]);
    if (dup) throw new HttpError(409, `${member.name} уже в бригаде`);
    await t.query(
      `INSERT INTO ev_crew (company_id, event_id, user_id, user_name, role, pay_amount)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.company_id, event.id, member.id, member.name, member.role, pay]);
  }));

  r.put('/:id/crew/:crewId', withEditableEvent(async (t, req, event) => {
    const crewId = v.id(req.params.crewId, { field: 'Участник', required: true });
    const pay = v.amount((req.body || {}).pay_amount, { field: 'Оплата', required: true });
    const { rowCount } = await t.query(
      'UPDATE ev_crew SET pay_amount = $3 WHERE id = $1 AND event_id = $2', [crewId, event.id, pay]);
    if (!rowCount) throw new HttpError(404, 'Участник бригады не найден');
  }));

  r.delete('/:id/crew/:crewId', withEditableEvent(async (t, req, event) => {
    const crewId = v.id(req.params.crewId, { field: 'Участник', required: true });
    const { rowCount } = await t.query('DELETE FROM ev_crew WHERE id = $1 AND event_id = $2', [crewId, event.id]);
    if (!rowCount) throw new HttpError(404, 'Участник бригады не найден');
  }));

  return r;
}

module.exports = { eventPartsRouter };
