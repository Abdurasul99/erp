// Задачи и матрица Эйзенхауэра (D29; ТЗ «Декор, обновление 2», раздел 2 — раздел «Управление»).
// Квадрат — urgent + important (перетаскивание в матрице меняет их), канбан — new → in_progress → review → done.
// Видимость: исполнитель и тот, кто поставил, видят задачу; учредитель (и «принимать выполненные задачи») — все.
// Права: себе задачу ставит каждый, другому — «ставить задачи» (assign_tasks); «готово» — «принимать выполненные задачи»
// (accept_tasks). Исключения: свою личную задачу и автозадачу «позвонить» исполнитель закрывает сам, с итогом.
// Менять название, срок, квадрат, исполнителя — тот, кто поставил, учредитель или «ставить задачи».
// Просроченные (срок прошёл, не «готово») — подсказка на Главной (hints.js → overdueTasks).
// Автозадачи по клиентам: раз в час сервер берёт даты клиентов на 7 дней вперёд (clients.collectDates) и ставит кассиру
// «позвонить и предложить»; auto_key (вид + кто + дата) уникален — одна задача на одну дату в год, повтор дубля не создаёт.
const F = require('./formulas');
const { TASK_STATUSES } = require('./defaults');
const { wrap, fail, idParam, toInt, todayYmd, isoDate, text, oneOf } = require('./common');

const NAME = a => `COALESCE(NULLIF(trim(concat_ws(' ', ${a}.first_name, ${a}.last_name)), ''), ${a}.username)`;
const SELECT = `SELECT t.id, t.title, t.description, t.assignee_id, t.created_by, to_char(t.due_date,'YYYY-MM-DD') AS due_date,
    t.urgent, t.important, t.status, t.order_id, t.client_id, t.source, t.auto_kind, t.relative_id,
    to_char(t.event_date,'YYYY-MM-DD') AS event_date, t.result, t.created_at, t.updated_at, t.done_at, t.done_by,
    ${NAME('ua')} AS assignee_name, ${NAME('uc')} AS creator_name, ${NAME('ud')} AS done_by_name,
    o.no AS order_no, c.name AS client_name, c.phone AS client_phone,
    r.name AS relative_name, r.relation AS relative_relation, r.not_married AS relative_not_married
  FROM decor_tasks t
  LEFT JOIN users ua ON ua.id = t.assignee_id
  LEFT JOIN users uc ON uc.id = t.created_by
  LEFT JOIN users ud ON ud.id = t.done_by
  LEFT JOIN decor_orders o ON o.id = t.order_id
  LEFT JOIN decor_clients c ON c.id = t.client_id
  LEFT JOIN decor_client_relatives r ON r.id = t.relative_id AND r.company_id = t.company_id`;
const REL_RU = { son: 'сын', daughter: 'дочь', brother: 'брат', sister: 'сестра', nephew: 'племянник/ца', other: 'родственник' };
const dm = ymd => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;

module.exports = ({ app, pool, A, has, ownerOnly, audit, txFor, collectDates }) => {
  const canAccept = req => req.decor.isOwner || has(req, 'accept_tasks');
  const canAssign = req => req.decor.isOwner || has(req, 'assign_tasks');
  const seeAll = req => canAccept(req);

  // Задачи, которые видит пользователь (+ доп. условие); $1 — компания, $2 — пользователь
  async function select(db, req, extra = '', vals = [], lock = false) {
    // $2 упомянут и при «видит все» — иначе PostgreSQL не примет лишний параметр
    const where = seeAll(req) ? 'AND $2::int IS NOT NULL' : 'AND (t.assignee_id=$2 OR t.created_by=$2)';
    const { rows } = await db.query(`${SELECT} WHERE t.company_id=$1 ${where} ${extra} ORDER BY t.due_date NULLS LAST, t.id ${lock ? 'FOR UPDATE OF t' : ''}`,
      [req.decor.cid, req.user.id, ...vals]);
    return rows;
  }
  const one = async (db, req, id, lock) => (await select(db, req, 'AND t.id=$3', [id], lock))[0] || fail(404, 'Задача не найдена');

  // Задача для экрана: квадрат, просрочка и что можно сделать этому пользователю
  function view(req, t, today = todayYmd()) {
    const me = req.user.id;
    const editor = req.decor.isOwner || t.created_by === me || canAssign(req);
    const assignee = t.assignee_id === me;
    const closeSelf = assignee && (t.source === 'auto_client_date' || t.created_by === me);
    const moves = t.status === 'done'
      ? (canAccept(req) ? ['new', 'in_progress', 'review'] : [])
      : [...(assignee || editor ? ['new', 'in_progress', 'review'] : []), ...(canAccept(req) || closeSelf ? ['done'] : [])].filter(s => s !== t.status);
    return {
      id: t.id, title: t.title, description: t.description, due_date: t.due_date, urgent: t.urgent, important: t.important,
      status: t.status, source: t.source, auto_kind: t.auto_kind, event_date: t.event_date, result: t.result,
      assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name } : null,
      created_by: t.created_by ? { id: t.created_by, name: t.creator_name } : null,
      done_by: t.done_by ? { id: t.done_by, name: t.done_by_name } : null, done_at: t.done_at, created_at: t.created_at,
      order: t.order_id ? { id: t.order_id, no: t.order_no } : null,
      client: t.client_id ? { id: t.client_id, name: t.client_name, phone: t.client_phone } : null,
      relative: t.relative_id && t.relative_name ? { id: t.relative_id, name: t.relative_name, relation: t.relative_relation, not_married: t.relative_not_married } : null,
      overdue: t.status !== 'done' && !!t.due_date && t.due_date < today,
      can: { edit: editor && t.status !== 'done', moves, accept: canAccept(req) },
    };
  }

  // Поля задачи из запроса (current — правка существующей)
  async function input(db, req, b, current) {
    const out = {};
    const hasK = k => Object.prototype.hasOwnProperty.call(b, k);
    const cid = req.decor.cid;
    if (!current || hasK('title')) out.title = text(b.title, 200) || fail(400, 'Название задачи обязательно', { code: 'task_title' });
    if (hasK('description')) out.description = text(b.description, 4000);
    if (hasK('due_date')) out.due_date = b.due_date ? isoDate(b.due_date, 'Срок') : null;
    if (hasK('urgent')) out.urgent = b.urgent === true;
    if (hasK('important')) out.important = b.important === true;
    if (!current || hasK('assignee_id')) {
      const id = hasK('assignee_id') && b.assignee_id !== null && b.assignee_id !== '' ? toInt(b.assignee_id) || fail(400, 'Неверный исполнитель') : req.user.id;
      if (id !== req.user.id && id !== current?.assignee_id && !canAssign(req)) {
        fail(403, 'Нет полномочия: ставить задачи', { code: 'no_permission', actions: ['assign_tasks'] });
      }
      const { rows: [u] } = await db.query('SELECT id, is_blocked FROM users WHERE id=$1 AND company_id=$2', [id, cid]);
      if (!u || u.is_blocked) fail(400, 'Исполнитель не найден в вашей компании');
      out.assignee_id = id;
    }
    if (hasK('order_id')) {
      const id = b.order_id ? toInt(b.order_id) || fail(400, 'Неверный заказ') : null;
      if (id && !(await db.query('SELECT 1 FROM decor_orders WHERE id=$1 AND company_id=$2', [id, cid])).rowCount) fail(400, 'Заказ не найден в вашей компании');
      out.order_id = id;
    }
    if (hasK('client_id')) {
      const id = b.client_id ? toInt(b.client_id) || fail(400, 'Неверный клиент') : null;
      if (id && !(await db.query('SELECT 1 FROM decor_clients WHERE id=$1 AND company_id=$2', [id, cid])).rowCount) fail(400, 'Клиент не найден в вашей компании');
      out.client_id = id;
    }
    return out;
  }

  app.get('/api/decor/tasks', A(), wrap(async (req, res) => {
    const today = todayYmd();
    const rows = await select(pool, req, "AND (t.status <> 'done' OR t.done_at > NOW() - INTERVAL '60 days')");
    res.json(rows.map(t => view(req, t, today)));
  }));

  // Кому можно поставить задачу: вошедшие сотрудники компании (без «ставить задачи» — только себе)
  app.get('/api/decor/tasks/people', A(), wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT u.id, ${NAME('u')} AS name, u.role FROM users u
      WHERE u.company_id=$1 AND NOT COALESCE(u.is_blocked, false) ORDER BY (u.role = 'founder') DESC, lower(${NAME('u')})`, [req.decor.cid]);
    res.json({ people: canAssign(req) ? rows : rows.filter(r => r.id === req.user.id), can_assign: canAssign(req), can_accept: canAccept(req) });
  }));

  // Ручной запуск автозадач по клиентам (учредитель): то же, что делает сервер раз в час
  app.post('/api/decor/tasks/auto/run', A(ownerOnly), wrap(async (req, res) => {
    const r = await txFor(req)(c => runAuto(c, req.decor.cid));
    res.json(r);
  }));

  app.get('/api/decor/tasks/:id', A(), wrap(async (req, res) => res.json(view(req, await one(pool, req, idParam(req))))));

  app.post('/api/decor/tasks', A(), wrap(async (req, res) => {
    const f = await input(pool, req, req.body || {}, null);
    const cols = Object.keys(f);
    const id = await txFor(req)(async c => (await c.query(`INSERT INTO decor_tasks (company_id, created_by, ${cols.join(', ')})
      VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`, [req.decor.cid, req.user.id, ...cols.map(k => f[k])])).rows[0].id);
    audit(req, 'create', 'decor_task', id, null, f);
    res.json(view(req, await one(pool, req, id)));
  }));

  app.put('/api/decor/tasks/:id', A(), wrap(async (req, res) => {
    const id = idParam(req);
    const cur = await one(pool, req, id);
    if (!view(req, cur).can.edit) {
      fail(cur.status === 'done' ? 409 : 403, cur.status === 'done' ? 'Задача уже принята — её не меняют' : 'Менять задачу может тот, кто её поставил, или учредитель',
        { code: cur.status === 'done' ? 'task_done' : 'task_forbidden' });
    }
    const f = await input(pool, req, req.body || {}, cur);
    const cols = Object.keys(f);
    if (!cols.length) fail(400, 'Нет полей для изменения');
    await txFor(req)(async c => {
      const t = await one(c, req, id, true);
      if (t.status === 'done') fail(409, 'Задача уже принята — её не меняют', { code: 'task_done' });
      await c.query(`UPDATE decor_tasks SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_at=NOW() WHERE id=$1`, [id, ...cols.map(k => f[k])]);
      return { id };
    });
    audit(req, 'update', 'decor_task', id, { urgent: cur.urgent, important: cur.important, assignee_id: cur.assignee_id, due_date: cur.due_date }, f);
    res.json(view(req, await one(pool, req, id)));
  }));

  app.post('/api/decor/tasks/:id/status', A(), wrap(async (req, res) => {
    const id = idParam(req);
    const to = oneOf(req.body?.status, TASK_STATUSES, 'Статус');
    const result = req.body?.result === undefined ? null : text(req.body.result, 500);
    await txFor(req)(async c => {
      const t = await one(c, req, id, true);
      if (t.status === to) fail(409, 'Задача уже в этом статусе', { code: 'task_same' });
      if (!view(req, t).can.moves.includes(to)) {
        fail(403, to === 'done' || t.status === 'done' ? 'Принимает задачу тот, у кого полномочие «принимать выполненные задачи»'
          : 'Статус меняет исполнитель или тот, кто поставил задачу', { code: 'task_forbidden' });
      }
      await c.query(`UPDATE decor_tasks SET status=$2::varchar, done_at=CASE WHEN $2::varchar='done' THEN NOW() END,
        done_by=CASE WHEN $2::varchar='done' THEN $3::int END,
        result=COALESCE($4, result), updated_at=NOW() WHERE id=$1`, [id, to, req.user.id, result]);
      return { id, status: to };
    });
    audit(req, 'status', 'decor_task', id, null, { status: to, result });
    res.json(view(req, await one(pool, req, id)));
  }));

  // ---------- Автозадачи по клиентам ----------
  // Кому: первый действующий кассир со входом; кассира нет — учредитель
  async function pickCashier(db, cid) {
    const { rows: [e] } = await db.query(`SELECT u.id FROM decor_employees e JOIN users u ON u.id = e.user_id
      WHERE e.company_id=$1 AND e.is_active AND u.role='cashier' AND NOT COALESCE(u.is_blocked, false) ORDER BY e.id LIMIT 1`, [cid]);
    if (e) return e.id;
    const { rows: [u] } = await db.query(`SELECT id FROM users WHERE company_id=$1 AND role IN ('cashier','founder') AND NOT COALESCE(is_blocked, false)
      ORDER BY (role = 'cashier') DESC, id LIMIT 1`, [cid]);
    return u?.id || null;
  }
  function autoTitle(e) {
    if (e.kind === 'client_birthday') return `Позвонить: ${e.client.name} — день рождения ${dm(e.date)}`;
    if (e.kind === 'relative_birthday') return `Позвонить: ${e.client.name} — день рождения: ${REL_RU[e.relative.relation] || ''} ${e.relative.name} ${dm(e.date)}`;
    return `Позвонить: ${e.client.name} — годовщина свадьбы ${dm(e.date)}`;
  }
  // За 7 дней до даты (и ближе — если клиента завели позже) — задача «позвонить и предложить»; дубль не создаётся
  async function runAuto(db, cid, today = todayYmd()) {
    const events = await collectDates(db, cid, today, F.addDays(today, 7));
    if (!events.length) return { created: 0, events: 0 };
    const assignee = await pickCashier(db, cid);
    let created = 0;
    for (const e of events) {
      const desc = [e.client.phone ? `Телефон: ${e.client.phone}` : null, e.order ? `Заказ ${e.order.no}` : null,
        e.relative?.not_married ? 'Не в браке — предложить оформление свадьбы' : null].filter(Boolean).join('\n') || null;
      const r = await db.query(`INSERT INTO decor_tasks (company_id, title, description, assignee_id, due_date, urgent, important, status,
          order_id, client_id, source, auto_key, auto_kind, relative_id, event_date)
        VALUES ($1,$2,$3,$4,$5::date,false,true,'new',$6,$7,'auto_client_date',$8,$9,$10,$5::date)
        ON CONFLICT (company_id, auto_key) WHERE auto_key IS NOT NULL DO NOTHING RETURNING id`,
      [cid, autoTitle(e).slice(0, 200), desc, assignee, e.date, e.order?.id || null, e.client.id, `${e.kind}:${e.ref}:${e.date}`, e.kind, e.relative?.id || null]);
      created += r.rowCount;
    }
    return { created, events: events.length };
  }
  let running = false;
  async function runAll() {
    if (running) return;
    running = true;
    try {
      const { rows } = await pool.query('SELECT company_id FROM decor_settings ORDER BY company_id');
      for (const { company_id: cid } of rows) {
        try {
          const r = await runAuto(pool, cid);
          if (r.created) console.log(`decor tasks: компания ${cid} — новых задач «позвонить» ${r.created}`);
        } catch (e) { if (e.code !== '42P01') console.error('decor auto tasks', cid, e.message); }
      }
    } catch (e) { if (e.code !== '42P01') console.error('decor auto tasks', e.message); } finally { running = false; }
  }
  if (process.env.DECOR_AUTOTASKS !== 'off') {
    setTimeout(runAll, 60 * 1000).unref();
    setInterval(runAll, 60 * 60 * 1000).unref();
  }

  // Для Главной и подсказок: мои открытые и просроченные из видимых
  async function taskSummary(req) {
    try {
      const today = todayYmd();
      const rows = await select(pool, req, "AND t.status <> 'done'");
      const overdue = rows.filter(t => t.due_date && t.due_date < today).map(t => view(req, t, today));
      return { mine_open: rows.filter(t => t.assignee_id === req.user.id).length, overdue: overdue.length, overdue_list: overdue.slice(0, 5) };
    } catch (e) {
      if (e.code === '42P01') return null;    // D29 ещё не применена
      throw e;
    }
  }

  return { taskSummary, runAutoTasks: runAuto };
};
