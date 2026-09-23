'use strict';

const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { requireScreen } = require('../auth');
const { assertCanEdit } = require('../scope');
const v = require('../validate');

// Клиенты компании — для выбора в заказе и отдельного справочника.
// Исполнителям справочник целиком не нужен: они видят клиента в карточке своего
// мероприятия, а телефоны всей клиентской базы — это уже не их зона.
const LIST_ROLES = new Set(['founder', 'project_manager', 'coordinator']);

function clientsRouter({ db }) {
  const r = express.Router();
  r.use(requireScreen('order'));
  r.use((req, res, next) => (LIST_ROLES.has(req.user.role) ? next() : next(new HttpError(403, 'Нет доступа к справочнику клиентов'))));

  r.get('/', asyncHandler(async (req, res) => {
    const params = [req.user.company_id];
    let where = 'c.company_id = $1 AND c.deleted_at IS NULL';
    const q = v.text(req.query.q, { field: 'Поиск', max: 100 });
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      where += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2)`;
    }
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.phone, c.notes,
              COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL)::int AS events_count,
              COALESCE(SUM(e.total_price) FILTER (WHERE e.deleted_at IS NULL AND e.status <> 'cancelled'), 0) AS total_spent,
              MAX(e.starts_at) FILTER (WHERE e.deleted_at IS NULL) AS last_event_at
         FROM ev_clients c
         LEFT JOIN ev_events e ON e.client_id = c.id
        WHERE ${where}
        GROUP BY c.id
        ORDER BY last_event_at DESC NULLS LAST, c.name
        LIMIT 200`, params);
    res.json({ items: rows });
  }));

  r.post('/', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const b = req.body || {};
    const { rows: [c] } = await db.query(
      `INSERT INTO ev_clients (company_id, name, phone, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, notes`,
      [req.user.company_id,
        v.text(b.name, { field: 'Имя', required: true, max: 200 }),
        v.text(b.phone, { field: 'Телефон', max: 40 }) || null,
        v.text(b.notes, { field: 'Заметки', max: 2000 }) || null,
        req.user.id]);
    res.status(201).json(c);
  }));

  r.put('/:id', asyncHandler(async (req, res) => {
    assertCanEdit(req.user);
    const id = v.id(req.params.id, { field: 'Клиент', required: true });
    const b = req.body || {};
    const sets = [];
    const params = [id, req.user.company_id];
    const put = (col, val) => {
      if (val === undefined) return;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (b.name !== undefined) put('name', v.text(b.name, { field: 'Имя', required: true, max: 200 }));
    put('phone', v.text(b.phone, { field: 'Телефон', max: 40 }));
    put('notes', v.text(b.notes, { field: 'Заметки', max: 2000 }));
    if (!sets.length) throw new HttpError(400, 'Нечего менять');
    const { rows: [c] } = await db.query(
      `UPDATE ev_clients SET ${sets.join(', ')}
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        RETURNING id, name, phone, notes`, params);
    if (!c) throw new HttpError(404, 'Клиент не найден');
    res.json(c);
  }));

  return r;
}

module.exports = { clientsRouter };
