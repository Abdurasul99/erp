'use strict';

const express = require('express');
const { asyncHandler } = require('../errors');
const { requireScreen } = require('../auth');
const { visibility } = require('../scope');
const { loadSettings } = require('../company');
const { STATUS_LABELS } = require('./events');

// Главная: что происходит сейчас и где нужно вмешаться. Все цифры считаются из
// тех же таблиц и по тем же правилам, что карточка заказа, — чтобы «к получению»
// на главной сходилось с суммой остатков в заказах.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function dashboardRouter({ db }) {
  const r = express.Router();
  r.use(requireScreen('dash'));

  r.get('/', asyncHandler(async (req, res) => {
    const vis = visibility(req.user, 'e', 1);
    const settings = await loadSettings(db, req.user.company_id);
    const overdueDaysParam = vis.params.length + 1;

    const [counts, money, upcoming, stages, debtors] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE e.status IN ('draft', 'confirmed', 'in_progress'))::int AS active,
           COUNT(*) FILTER (WHERE e.status = 'draft')::int AS drafts,
           COUNT(*) FILTER (WHERE e.status <> 'cancelled'
             AND date_trunc('month', e.starts_at AT TIME ZONE 'Asia/Tashkent')
               = date_trunc('month', now() AT TIME ZONE 'Asia/Tashkent'))::int AS this_month
         FROM ev_events e WHERE ${vis.sql}`, vis.params),
      // Выручка месяца — по дате проведения. К получению — остатки по
      // подтверждённым, идущим и завершённым: черновик ещё не долг клиента.
      db.query(
        `SELECT
           COALESCE(SUM(e.total_price) FILTER (WHERE e.status <> 'cancelled'
             AND date_trunc('month', e.starts_at AT TIME ZONE 'Asia/Tashkent')
               = date_trunc('month', now() AT TIME ZONE 'Asia/Tashkent')), 0) AS revenue_month,
           COALESCE(SUM(GREATEST(e.total_price - COALESCE(p.paid, 0), 0))
             FILTER (WHERE e.status IN ('confirmed', 'in_progress', 'completed')), 0) AS to_collect
         FROM ev_events e
         LEFT JOIN (SELECT event_id, SUM(amount) AS paid FROM ev_payments GROUP BY event_id) p ON p.event_id = e.id
         WHERE ${vis.sql}`, vis.params),
      db.query(
        `SELECT e.id, e.title, e.event_type, e.starts_at, e.venue, e.status, e.total_price,
                c.name AS client_name,
                COALESCE(p.paid, 0) AS paid,
                st.next_stage, st.next_due, st.next_role, st.next_status
           FROM ev_events e
           LEFT JOIN ev_clients c ON c.id = e.client_id
           LEFT JOIN (SELECT event_id, SUM(amount) AS paid FROM ev_payments GROUP BY event_id) p ON p.event_id = e.id
           LEFT JOIN LATERAL (
             SELECT s.name AS next_stage, s.due_at AS next_due, s.responsible_role AS next_role, s.status AS next_status
               FROM ev_event_stages s
              WHERE s.event_id = e.id AND s.status <> 'accepted'
              ORDER BY s.position LIMIT 1
           ) st ON true
          WHERE ${vis.sql} AND e.status IN ('draft', 'confirmed', 'in_progress')
            AND e.starts_at >= now() - interval '1 day'
          ORDER BY e.starts_at
          LIMIT 12`, vis.params),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE s.status = 'submitted')::int AS awaiting_review,
           COUNT(*) FILTER (WHERE s.status IN ('pending', 'returned') AND s.due_at < now())::int AS overdue
         FROM ev_event_stages s JOIN ev_events e ON e.id = s.event_id
         WHERE ${vis.sql} AND e.status IN ('draft', 'confirmed', 'in_progress')`, vis.params),
      // Должники: мероприятие прошло больше N дней назад, а оплачено не всё.
      db.query(
        `SELECT e.id, e.title, e.starts_at, e.total_price, COALESCE(p.paid, 0) AS paid, c.name AS client_name
           FROM ev_events e
           LEFT JOIN ev_clients c ON c.id = e.client_id
           LEFT JOIN (SELECT event_id, SUM(amount) AS paid FROM ev_payments GROUP BY event_id) p ON p.event_id = e.id
          WHERE ${vis.sql} AND e.status IN ('in_progress', 'completed')
            AND e.starts_at < now() - make_interval(days => $${overdueDaysParam})
            AND e.total_price > COALESCE(p.paid, 0)
          ORDER BY e.starts_at
          LIMIT 10`, [...vis.params, settings.payment_overdue_days]),
    ]);

    res.json({
      counts: counts.rows[0],
      money: {
        revenue_month: round2(money.rows[0].revenue_month),
        to_collect: round2(money.rows[0].to_collect),
      },
      stages: stages.rows[0],
      upcoming: upcoming.rows.map((e) => ({
        id: e.id,
        title: e.title,
        event_type: e.event_type,
        starts_at: e.starts_at,
        venue: e.venue,
        status: e.status,
        status_label: STATUS_LABELS[e.status],
        client_name: e.client_name,
        total_price: round2(e.total_price),
        remaining: round2(e.total_price - e.paid),
        next_stage: e.next_stage
          ? { name: e.next_stage, due_at: e.next_due, role: e.next_role, status: e.next_status,
              overdue: e.next_due ? new Date(e.next_due).getTime() < Date.now() : false }
          : null,
      })),
      debtors: debtors.rows.map((e) => ({
        id: e.id,
        title: e.title,
        starts_at: e.starts_at,
        client_name: e.client_name,
        remaining: round2(e.total_price - e.paid),
      })),
      settings: { payment_overdue_days: settings.payment_overdue_days, target_margin_pct: Number(settings.target_margin_pct) },
    });
  }));

  return r;
}

module.exports = { dashboardRouter };
