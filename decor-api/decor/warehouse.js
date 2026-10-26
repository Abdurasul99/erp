// Склад и бронь: заявки на сборку, выдача, довыдача, возврат остатка, финальный возврат по вещам, поздний возврат;
// таблица брони по дням, конфликты, «не вернулось с объекта», недостача под вопросом, свободно на дату для калькулятора.
// Доказательства обязательны (D24): выдача и финальный возврат (по вещи и «принять всё») — multipart с фото по требованию
// этапа; при недостаче на финале — ещё комментарий или фото. Доказательство пишется в той же транзакции, что и движение.
const F = require('./formulas');
const { loadCompany } = require('./data');
const { makeView } = require('./views');
const { wrap, fail, idParam, toInt, todayYmd, isoDate, intIn, oneOf, text } = require('./common');
const U = require('./uploads');

module.exports = ({ app, pool, A, can, feature, audit, tx, txFor, idem, lockOrder, loadModel, requireEvidence, saveEvidence }) => {
  const WH = feature('decor-warehouse');
  const ORD = feature('decor-orders');

  // Модель внутри транзакции после блокировки заказа — проверки «не больше, чем на объекте» по свежим данным
  async function modelIn(c, req, orderId) {
    const data = await loadCompany(c, req.decor.cid);
    const m = F.model(data, todayYmd());
    return { data, m, o: data.orders.find(x => x.id === orderId) };
  }
  // afterClose — сумма позднего возврата по закрытому заказу («возвращено после закрытия»); evidenceId — доказательство
  const addMove = (c, req, orderId, itemId, type, qty, afterClose = null, evidenceId = null) => c.query(
    `INSERT INTO decor_moves (company_id, order_id, item_id, type, qty, move_date, user_id, after_close, amount_usd, evidence_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [req.decor.cid, orderId, itemId, type, qty, todayYmd(), req.user.id, afterClose !== null, afterClose, evidenceId]);
  async function itemOfCompany(req, id) {
    const { rows: [it] } = await pool.query('SELECT id, name FROM decor_items WHERE id=$1 AND company_id=$2', [id, req.decor.cid]);
    return it || fail(400, 'Вещь не найдена в вашей компании');
  }

  // ---------- Обзор склада ----------
  // requests — заявки на сборку; on_site — заказы с декором на объекте (по каждой вещи: принят ли финал);
  // not_returned — период кончился, финала по вещам нет; shortage_pending — «недостача под вопросом» (финал принят,
  // не хватает, заказ не закрыт); shortage_fixed — недостача в закрытых заказах (если вещь найдётся — «Поздний возврат»).
  app.get('/api/decor/warehouse', A(WH), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const items = v.items;
    const requests = data.orders.filter(o => ['prepay', 'booked'].includes(o.status) && o.lines.length && !o.moves.some(x => x.type === 'issue'))
      .map(o => ({ ...v.summary(o), lines: o.lines.map(l => ({ item_id: l.item_id, item: items.get(l.item_id)?.name, qty: l.qty, free: m.freeForOrder(o, l.item_id) })) }));
    const onSite = data.orders.filter(o => o.status !== 'closed' && o.moves.some(x => x.type === 'issue'))
      .map(o => ({ ...v.summary(o), flows: m.orderItemIds(o).map(id => ({ item_id: id, item: items.get(id)?.name, ...m.itemFlow(o, id) })),
        waiting_final: m.closeChecklist(o).waiting_final }));
    const shortage = status => data.orders.filter(o => m.shortageStatus(o) === status)
      .map(o => ({ order_id: o.id, no: o.no, client: o.client, order_status: o.status, event_date: o.event_date, ...v.shortageView(o) }));
    res.json({ requests, on_site: onSite, not_returned: m.notReturned(), shortage_pending: shortage('pending'), shortage_fixed: shortage('fixed') });
  }));

  // ---------- Выдача по заявке: можно больше или меньше дизайна — пишется факт ----------
  app.post('/api/decor/orders/:id/issue', A(WH, can('handle_decor'), idem), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const given = U.jsonField(req.body?.lines, 'lines');
    if (!Array.isArray(given)) fail(400, 'lines — список вещей');
    const lines = [];
    for (const l of given) {
      const itemId = toInt(l?.item_id) || fail(400, 'Неверная вещь');
      const qty = intIn(l?.qty ?? 0, 'Выдать, шт', 0);
      if (qty > 0) { await itemOfCompany(req, itemId); lines.push({ item_id: itemId, qty }); }
    }
    if (!lines.length) fail(400, 'Нечего выдавать — все количества 0');
    await U.checkSizes(pool, req);
    await requireEvidence(pool, req, 'issue');
    await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (['lead', 'closed'].includes(o.status)) fail(409, 'Выдача возможна для оформленного и не закрытого заказа');
      const { rows: [done] } = await c.query("SELECT 1 FROM decor_moves WHERE order_id=$1 AND type='issue' LIMIT 1", [id]);
      if (done) fail(409, 'По заказу уже выдано — используйте «Довыдать»');
      const ev = await saveEvidence(c, req, { orderId: id, stage: 'issue', comment: text(req.body?.comment, 1000) });
      for (const l of lines) await addMove(c, req, id, l.item_id, 'issue', l.qty, null, ev);
      // Декор уехал на объект — заказ в «Монтаж»
      if (['design', 'prepay', 'booked'].includes(o.status)) await c.query("UPDATE decor_orders SET status='install', updated_at=NOW() WHERE id=$1", [id]);
    });
    audit(req, 'issue', 'decor_order', id, null, { lines, files: (req.files || []).length });
    const { data, m } = await loadModel(req);
    res.json(makeView(req, data, m).card(data.orders.find(x => x.id === id)));
  })));

  // ---------- Движение по строке: довыдать / остаток / финал / поздний возврат ----------
  // Финал по вещи принимается один раз (можно 0 — «ничего не вернулось»): с его даты вещь свободна в брони,
  // недостающее — «недостача под вопросом». Нашлось и привезли — «Поздний возврат» (и после закрытия заказа:
  // вещь возвращается на склад, снимок себестоимости закрытого заказа не меняется, а движение помечается
  // «возвращено после закрытия» с суммой по цене из снимка и пишется в журнал).
  app.post('/api/decor/orders/:id/moves', A(WH, can('handle_decor'), idem), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const type = oneOf(req.body?.type, ['extra', 'left', 'final', 'late_return'], 'Движение');
    const comment = text(req.body?.comment, 1000);
    if (type !== 'final' && (req.files || []).length) fail(400, 'Фото нужны только к финальному возврату');
    if (type === 'final') await U.checkSizes(pool, req);
    const itemId = toInt(req.body?.item_id) || fail(400, 'Неверная вещь');
    const qty = intIn(req.body?.qty, 'Количество', type === 'final' ? 0 : 1);
    const it = await itemOfCompany(req, itemId);
    const afterClose = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      const { m, o: od } = await modelIn(c, req, id);
      const f = m.itemFlow(od, itemId);
      if (type === 'late_return') {
        if (!f.final_done && o.status !== 'closed') fail(409, `«Поздний возврат» — после финального возврата по «${it.name}»`, { code: 'no_final' });
        if (f.onSite <= 0) fail(409, `По «${it.name}» недостачи нет`);
        if (qty > f.onSite) fail(409, `Не хватает только ${f.onSite} шт`, { on_site: f.onSite });
        if (o.status === 'closed') {
          const price = m.closedPrice(od, itemId);
          const amount = Math.round(qty * price * 100) / 100;
          await addMove(c, req, id, itemId, type, qty, amount);
          return { order_no: o.no, item_id: itemId, item: it.name, qty, price_usd: price, amount_usd: amount };
        }
      } else {
        if (['lead', 'closed'].includes(o.status)) fail(409, 'Заказ не на объекте');
        if (!od.moves.some(x => x.type === 'issue')) fail(409, 'Сначала выдайте декор по заявке');
        if (f.final_done) fail(409, `По «${it.name}» финальный возврат уже принят — если вещь нашлась, это «Поздний возврат»`, { code: 'final_done' });
        if (type === 'final' && !f.issued) fail(409, `«${it.name}» не выдавалась на объект`);
        if (type === 'final' && f.onSite <= 0) fail(409, `«${it.name}»: на объекте ничего нет — финал не нужен`);
        if (type !== 'extra' && qty > f.onSite) fail(409, `На объекте только ${f.onSite} шт`, { on_site: f.onSite });
      }
      if (type === 'final') {
        // Финал по вещи — с фото; не вернулось что-то — ещё комментарий о недостаче или фото
        await requireEvidence(c, req, 'final', { shortage: qty < f.onSite, comment });
        const ev = await saveEvidence(c, req, { orderId: id, stage: 'final', comment });
        await addMove(c, req, id, itemId, type, qty, null, ev);
      } else await addMove(c, req, id, itemId, type, qty);
      return null;
    });
    // Журнал: обычное движение — по типу; после закрытия — «возвращено после закрытия» с суммой
    if (afterClose) audit(req, 'returned_after_close', 'decor_order', id, null, afterClose);
    else audit(req, type, 'decor_order', id, null, { item_id: itemId, qty, ...(type === 'final' ? { files: (req.files || []).length, comment } : {}) });
    const { data, m } = await loadModel(req);
    res.json(makeView(req, data, m).card(data.orders.find(x => x.id === id)));
  })));

  // ---------- «Принять всё как финальный возврат» ----------
  // По каждой вещи без финала и с декором на объекте пишется финал: количество из lines (можно поправить, можно 0),
  // иначе — всё, что на объекте. Вещи, по которым финал уже принят, не трогаются.
  app.post('/api/decor/orders/:id/final-all', A(WH, can('handle_decor'), idem), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const given = new Map();
    const comment = text(req.body?.comment, 1000);
    const list = U.jsonField(req.body?.lines, 'lines');
    await U.checkSizes(pool, req);
    for (const l of Array.isArray(list) ? list : []) {
      given.set(toInt(l?.item_id) || fail(400, 'Неверная вещь'), intIn(l?.qty ?? 0, 'Финальный возврат, шт', 0));
    }
    const accepted = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (['lead', 'closed'].includes(o.status)) fail(409, 'Заказ не на объекте');
      const { m, o: od } = await modelIn(c, req, id);
      const out = [];
      for (const itemId of m.orderItemIds(od)) {
        const f = m.itemFlow(od, itemId);
        if (f.final_done || f.onSite <= 0) continue;
        const qty = given.has(itemId) ? given.get(itemId) : f.onSite;
        if (qty > f.onSite) fail(409, `На объекте только ${f.onSite} шт`, { item_id: itemId, on_site: f.onSite });
        out.push({ item_id: itemId, qty, short: f.onSite - qty });
      }
      if (!out.length) fail(409, 'Принимать нечего: по всем вещам финал уже принят или на объекте ничего нет');
      // Одно доказательство на весь финальный возврат; при недостаче — комментарий или ещё фото
      await requireEvidence(c, req, 'final', { shortage: out.some(x => x.short > 0), comment });
      const ev = await saveEvidence(c, req, { orderId: id, stage: 'final', comment });
      for (const x of out) await addMove(c, req, id, x.item_id, 'final', x.qty, null, ev);
      return out;
    });
    audit(req, 'final_all', 'decor_order', id, null, { accepted, files: (req.files || []).length, comment });
    const { data, m } = await loadModel(req);
    const o = data.orders.find(x => x.id === id);
    res.json({ ...makeView(req, data, m).card(o), accepted });
  })));

  // ---------- Бронь: вещи × дни, конфликты, «не вернулось с объекта» ----------
  app.get('/api/decor/booking', A(ORD), wrap(async (req, res) => {
    const today = todayYmd();
    const from = req.query.from ? isoDate(req.query.from, 'from') : today;
    const days = req.query.days ? intIn(req.query.days, 'days', 1, 62) : 14;
    const { data, m } = await loadModel(req);
    const dayList = F.dayRange(from, F.addDays(from, days - 1));
    const items = data.items.filter(it => it.is_active).map(it => ({
      id: it.id, name: it.name, stock: m.stock(it.id),
      cells: dayList.map(d => ({ day: d, ...m.bookingCell(it.id, d) })),
    }));
    const byDay = dayList.map(d => ({ day: d, orders: data.orders.filter(o => m.reservesOn(o, d))
      .map(o => ({ id: o.id, no: o.no, client: o.client, status: o.status, event_date: o.event_date })) })).filter(x => x.orders.length);
    res.json({ today, days: dayList, days_on_site: data.settings.days_on_site, items, conflicts: m.conflicts(), not_returned: m.notReturned(), orders_by_day: byDay });
  }));

  // Свободно для нового заказа на дату (весь его период) — для калькулятора; order_id — без своей брони
  app.get('/api/decor/availability', A(ORD), wrap(async (req, res) => {
    const date = isoDate(req.query.date, 'Дата');
    const exceptId = toInt(req.query.order_id);
    const { data, m } = await loadModel(req);
    const to = F.addDays(date, data.settings.days_on_site);
    res.json({ period: { from: date, to }, items: data.items.filter(it => it.is_active)
      .map(it => { const why = m.freeDetail(it.id, date, to, exceptId); return { id: it.id, name: it.name, free: why.free, why }; }) });
  }));
};
