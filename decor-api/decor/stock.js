// Журнал склада (D25): «Куплено» вещи меняется только здесь — новое значение и строка журнала в одной транзакции.
// kind: opening — начальный остаток новой вещи, receipt — приход, writeoff — списание, count — инвентаризация
// (qty = насчитали − должно быть), purchase — покупка из фонда. Сумма qty по вещи = её qty_bought.
// Выдача и возврат по заказам — decor_moves, «Куплено» они не меняют.
const { fail } = require('./common');

// c — клиент транзакции; qty — изменение «Куплено» (+ / −). Ниже 0 «Куплено» не уйдёт (CHECK в decor_items).
async function stockMove(c, { cid, itemId, kind, qty, userId = null, comment = null, counted = null, expected = null, fundSpendId = null }) {
  const { rows: [it] } = await c.query(
    'UPDATE decor_items SET qty_bought = qty_bought + $3 WHERE id=$1 AND company_id=$2 RETURNING qty_bought', [itemId, cid, qty]);
  if (!it) fail(404, 'Вещь не найдена');
  const { rows: [m] } = await c.query(
    `INSERT INTO decor_stock_moves (company_id, item_id, kind, qty, qty_after, counted, expected, comment, fund_spend_id, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [cid, itemId, kind, qty, it.qty_bought, counted, expected, comment, fundSpendId, userId]);
  return { id: m.id, qty_after: it.qty_bought };
}

module.exports = { stockMove };
