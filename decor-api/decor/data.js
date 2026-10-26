// Данные компании для формул (formulas.js) одной выборкой. db — пул сферы или клиент транзакции.
// Деньги отдаются числами (::float8), даты — строкой 'ГГГГ-ММ-ДД' (to_char), чтобы не зависеть от часового пояса.
const { DEFAULT_EVIDENCE } = require('./defaults');

async function loadCompany(db, cid) {
  const q = sql => db.query(sql, [cid]).then(r => r.rows);
  const [settingsRows, items, employees, rateRows, orders, team, lines, moves, payments, reports, payroll, files,
    ruleRows, evidence, fundSpend] = await Promise.all([
    q(`SELECT rate_uzs::float8 AS rate_uzs, transport_usd::float8 AS transport_usd, consumables_uzs::float8 AS consumables_uzs,
              target_usd::float8 AS target_usd, repair_uzs::float8 AS repair_uzs, other_fixed_usd::float8 AS other_fixed_usd,
              expected_orders, days_on_site, panel_off, order_seq, photo_max_mb, video_max_mb
       FROM decor_settings WHERE company_id=$1`),
    q(`SELECT id, name, qty_bought, price_usd::float8 AS price_usd, resource_orders, is_active, sort_order
       FROM decor_items WHERE company_id=$1 ORDER BY sort_order, id`),
    q('SELECT id, name, phone, level, user_id, is_active FROM decor_employees WHERE company_id=$1 ORDER BY id'),
    q('SELECT level, order_type, amount_usd::float8 AS amount_usd FROM decor_pay_rates WHERE company_id=$1'),
    q(`SELECT id, branch_id, no, client, phone, address, to_char(event_date,'YYYY-MM-DD') AS event_date, type, status,
              price_usd::float8 AS price_usd, transport_usd::float8 AS transport_usd, consumables_uzs::float8 AS consumables_uzs,
              rented_decor_usd::float8 AS rented_decor_usd, other_usd::float8 AS other_usd, note, created_by, created_at,
              closed_at, closed_cost
       FROM decor_orders WHERE company_id=$1 ORDER BY event_date, id`),
    q('SELECT order_id, employee_id FROM decor_order_team WHERE company_id=$1 ORDER BY employee_id'),
    q('SELECT order_id, item_id, qty FROM decor_order_lines WHERE company_id=$1 ORDER BY id'),
    q(`SELECT id, order_id, item_id, type, qty, to_char(move_date,'YYYY-MM-DD') AS move_date, user_id,
              after_close, amount_usd::float8 AS amount_usd, evidence_id
       FROM decor_moves WHERE company_id=$1 ORDER BY id`),
    q(`SELECT id, order_id, amount_usd::float8 AS amount_usd, kind, received_by_employee_id, status,
              to_char(pay_date,'YYYY-MM-DD') AS pay_date, handed_at, confirmed_at
       FROM decor_payments WHERE company_id=$1 ORDER BY pay_date, id`),
    q(`SELECT id, order_id, stage, employee_id, status, comment, reply, to_char(report_date,'YYYY-MM-DD') AS report_date, decided_at
       FROM decor_reports WHERE company_id=$1 ORDER BY id`),
    q(`SELECT id, order_id, employee_id, level, order_type, amount_usd::float8 AS amount_usd, status, report_id, created_at, paid_at, paid_by
       FROM decor_payroll WHERE company_id=$1 ORDER BY id`),
    q('SELECT id, report_id, evidence_id, kind, original_name, mime, size_bytes FROM decor_report_files WHERE company_id=$1 ORDER BY id'),
    q('SELECT stage, min_photos, need_video, shortage_note FROM decor_evidence_rules WHERE company_id=$1'),
    q(`SELECT id, order_id, stage, payment_id, comment, created_by, created_at
       FROM decor_evidence WHERE company_id=$1 ORDER BY id`),
    q(`SELECT id, amount_usd::float8 AS amount_usd, comment, item_id, qty, unit_price_usd::float8 AS unit_price_usd, new_item,
              to_char(spend_date,'YYYY-MM-DD') AS spend_date, created_by, created_at
       FROM decor_fund_spend WHERE company_id=$1 ORDER BY spend_date, id`),
  ]);
  if (!settingsRows[0]) throw Object.assign(new Error('Компания сферы «Декор» не настроена (нет decor_settings)'), { statusCode: 409 });

  const rates = {};
  for (const r of rateRows) (rates[r.level] ||= {})[r.order_type] = r.amount_usd;
  // Требования к доказательствам: строки компании, недостающие этапы — по умолчанию
  const evidenceRules = Object.fromEntries(Object.entries(DEFAULT_EVIDENCE).map(([k, v]) => [k, { ...v }]));
  for (const r of ruleRows) evidenceRules[r.stage] = { min_photos: r.min_photos, need_video: r.need_video, shortage_note: r.shortage_note };

  const byKey = (rows, key) => { const m = new Map(); for (const r of rows) { if (r[key] === null || r[key] === undefined) continue; if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); } return m; };
  const [T, L, M, P, R, E] = [team, lines, moves, payments, reports, evidence].map(rows => byKey(rows, 'order_id'));
  const filesByReport = byKey(files, 'report_id');
  const filesByEvidence = byKey(files, 'evidence_id');
  for (const r of reports) r.files = filesByReport.get(r.id) || [];
  for (const e of evidence) e.files = filesByEvidence.get(e.id) || [];
  for (const o of orders) {
    o.team = (T.get(o.id) || []).map(r => r.employee_id);
    o.lines = L.get(o.id) || [];
    o.moves = M.get(o.id) || [];
    o.payments = P.get(o.id) || [];
    o.reports = R.get(o.id) || [];
    o.evidence = E.get(o.id) || [];
  }
  return { settings: settingsRows[0], items, employees, rates, orders, payroll, evidenceRules, fundSpend };
}

module.exports = { loadCompany };
