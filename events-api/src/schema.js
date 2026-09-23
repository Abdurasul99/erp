'use strict';

// Схема отдельной базы `events`.
//
// company_id, branch_id и user_id здесь — ССЫЛКИ ПО ЗНАЧЕНИЮ на учётки из базы
// warehouse: внешний ключ между базами PostgreSQL невозможен. Целостность держит
// сервис — company_id всегда берётся из проверенного токена, а не из тела запроса.
//
// Миграции нумерованы и применяются по одной, каждая в своей транзакции, с
// записью в ev_migrations. Сбой останавливает запуск сервиса с понятным логом.
// Это сознательное отличие от ensureSchema в Wave, где всё завёрнуто в общий
// try/catch и одна упавшая миграция молча отключает все следующие.
//
// Только синтаксис PostgreSQL 14 (прод 14.24): без MERGE, NULLS NOT DISTINCT и
// прочего из 15+, хотя тесты гоняются на PGlite 16.

const MIGRATIONS = [
  {
    id: 1,
    name: 'ядро: клиенты, мероприятия, каталог, позиции, оплаты, смета, бригада',
    sql: `
      CREATE TABLE ev_clients (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        phone       TEXT,
        notes       TEXT,
        created_by  INT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at  TIMESTAMPTZ
      );
      CREATE INDEX ev_clients_company ON ev_clients (company_id) WHERE deleted_at IS NULL;

      CREATE TABLE ev_events (
        id           SERIAL PRIMARY KEY,
        company_id   INT NOT NULL,
        branch_id    INT,
        title        TEXT NOT NULL CHECK (length(btrim(title)) > 0),
        event_type   TEXT NOT NULL DEFAULT 'Свадьба',
        starts_at    TIMESTAMPTZ NOT NULL,
        ends_at      TIMESTAMPTZ,
        venue        TEXT,
        address      TEXT,
        client_id    INT REFERENCES ev_clients (id),
        status       TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
        -- Цена, согласованная с клиентом. Единственный источник выручки события:
        -- сумма позиций декора — это расчёт, а не выручка (скидка, работы, округление).
        total_price  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
        notes        TEXT,
        created_by   INT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        closed_at    TIMESTAMPTZ,
        deleted_at   TIMESTAMPTZ,
        CHECK (ends_at IS NULL OR ends_at >= starts_at)
      );
      CREATE INDEX ev_events_company_date ON ev_events (company_id, starts_at) WHERE deleted_at IS NULL;

      -- Каталог: прокат (возвращается) и расходники (списываются в событие).
      CREATE TABLE ev_items (
        id              SERIAL PRIMARY KEY,
        company_id      INT NOT NULL,
        name            TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        category        TEXT NOT NULL CHECK (category IN ('rental', 'consumable')),
        unit            TEXT NOT NULL DEFAULT 'шт',
        -- Прокат: сколько единиц в собственности. Расходник: текущий остаток.
        qty_total       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (qty_total >= 0),
        -- Цена клиенту за единицу на одно событие.
        price           NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
        -- Расходник: себестоимость единицы. Прокат: амортизация за одну выдачу.
        cost            NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
        -- Прокат: закупочная цена единицы — для окупаемости.
        purchase_price  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
        condition       TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'worn', 'damaged')),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at      TIMESTAMPTZ
      );
      CREATE INDEX ev_items_company ON ev_items (company_id) WHERE deleted_at IS NULL;

      CREATE TABLE ev_packages (
        id           SERIAL PRIMARY KEY,
        company_id   INT NOT NULL,
        name         TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        description  TEXT,
        price        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at   TIMESTAMPTZ
      );

      CREATE TABLE ev_package_items (
        id          SERIAL PRIMARY KEY,
        package_id  INT NOT NULL REFERENCES ev_packages (id) ON DELETE CASCADE,
        item_id     INT NOT NULL REFERENCES ev_items (id),
        qty         NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
        UNIQUE (package_id, item_id)
      );

      -- Позиции декора в конкретном мероприятии. name/price/cost — снимок на
      -- момент добавления: правка каталога не должна переписывать прошлые сметы.
      CREATE TABLE ev_event_items (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        event_id    INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        item_id     INT REFERENCES ev_items (id),
        package_id  INT REFERENCES ev_packages (id),
        name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        category    TEXT NOT NULL CHECK (category IN ('rental', 'consumable')),
        qty         NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
        price       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
        cost        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX ev_event_items_event ON ev_event_items (event_id);

      CREATE TABLE ev_payments (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        event_id    INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
        method      TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'transfer')),
        paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        note        TEXT,
        created_by  INT
      );
      CREATE INDEX ev_payments_event ON ev_payments (event_id);

      -- Смета и факт по пяти статьям себестоимости. planned = NULL значит «не
      -- задано вручную» — тогда смета считается из позиций и бригады (money.js).
      CREATE TABLE ev_cost_lines (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        event_id    INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        category    TEXT NOT NULL CHECK (category IN ('materials', 'team', 'logistics', 'amort', 'other')),
        planned     NUMERIC(14, 2) CHECK (planned IS NULL OR planned >= 0),
        actual      NUMERIC(14, 2) CHECK (actual IS NULL OR actual >= 0),
        note        TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (event_id, category)
      );

      -- Бригада мероприятия. user_id — учётка из warehouse; имя и роль сохраняем
      -- снимком, чтобы карточка читалась без обращения к чужой базе.
      CREATE TABLE ev_crew (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        event_id    INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        user_id     INT NOT NULL,
        user_name   TEXT NOT NULL,
        role        TEXT NOT NULL,
        pay_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (pay_amount >= 0),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (event_id, user_id)
      );
      CREATE INDEX ev_crew_user ON ev_crew (company_id, user_id);
    `,
  },
  {
    id: 2,
    name: 'прокат: брони по датам, выдача и возврат',
    sql: `
      CREATE TABLE ev_reservations (
        id            SERIAL PRIMARY KEY,
        company_id    INT NOT NULL,
        item_id       INT NOT NULL REFERENCES ev_items (id),
        event_id      INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        qty           NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
        date_from     DATE NOT NULL,
        date_to       DATE NOT NULL,
        status        TEXT NOT NULL DEFAULT 'reserved'
                      CHECK (status IN ('reserved', 'issued', 'returned', 'cancelled')),
        returned_qty  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
        damaged_qty   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
        issued_at     TIMESTAMPTZ,
        returned_at   TIMESTAMPTZ,
        created_by    INT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (date_to >= date_from),
        CHECK (returned_qty + damaged_qty <= qty)
      );
      CREATE INDEX ev_reservations_item_dates ON ev_reservations (company_id, item_id, date_from, date_to);
      CREATE INDEX ev_reservations_event ON ev_reservations (event_id);
    `,
  },
  {
    id: 3,
    name: 'воронка этапов: шаблоны и этапы мероприятия',
    sql: `
      CREATE TABLE ev_funnel_templates (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL,
        name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        event_type  TEXT,
        is_default  BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at  TIMESTAMPTZ
      );

      -- Срок этапа задаётся точкой отсчёта и смещением в часах — так выражаются
      -- все правила из макета: «в течение дня после обращения» (created, +24),
      -- «за 14 дней до события» (start, -336), «в течение 12 часов после» (end, +12).
      CREATE TABLE ev_funnel_stages (
        id                     SERIAL PRIMARY KEY,
        company_id             INT NOT NULL,
        template_id            INT NOT NULL REFERENCES ev_funnel_templates (id) ON DELETE CASCADE,
        position               INT NOT NULL,
        name                   TEXT NOT NULL CHECK (length(btrim(name)) > 0),
        responsible_role       TEXT NOT NULL,
        proof_type             TEXT NOT NULL DEFAULT 'photo'
                               CHECK (proof_type IN ('checklist', 'file', 'photo', 'video', 'none')),
        deadline_anchor        TEXT NOT NULL DEFAULT 'start' CHECK (deadline_anchor IN ('created', 'start', 'end')),
        deadline_offset_hours  INT NOT NULL DEFAULT 0 CHECK (deadline_offset_hours BETWEEN -8760 AND 8760),
        -- Пункты приёмки: [{ "text": "...", "required": true }]
        checklist              JSONB NOT NULL DEFAULT '[]'::jsonb,
        instructions           TEXT
      );
      CREATE INDEX ev_funnel_stages_template ON ev_funnel_stages (template_id, position);

      -- Этапы конкретного мероприятия — копия шаблона на момент создания: правка
      -- шаблона не должна менять уже идущие мероприятия.
      CREATE TABLE ev_event_stages (
        id                SERIAL PRIMARY KEY,
        company_id        INT NOT NULL,
        event_id          INT NOT NULL REFERENCES ev_events (id) ON DELETE CASCADE,
        position          INT NOT NULL,
        name              TEXT NOT NULL,
        responsible_role  TEXT NOT NULL,
        proof_type        TEXT NOT NULL DEFAULT 'photo'
                          CHECK (proof_type IN ('checklist', 'file', 'photo', 'video', 'none')),
        -- Правило срока хранится вместе с этапом: при переносе мероприятия
        -- сроки незакрытых этапов пересчитываются от новой даты.
        deadline_anchor        TEXT NOT NULL DEFAULT 'start' CHECK (deadline_anchor IN ('created', 'start', 'end')),
        deadline_offset_hours  INT NOT NULL DEFAULT 0,
        due_at            TIMESTAMPTZ,
        status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'submitted', 'accepted', 'returned')),
        -- Пункты приёмки с отметками: [{ "text": "...", "required": true, "done": false }]
        checklist         JSONB NOT NULL DEFAULT '[]'::jsonb,
        instructions      TEXT,
        report_text       TEXT,
        submitted_by      INT,
        submitted_at      TIMESTAMPTZ,
        reviewed_by       INT,
        reviewed_at       TIMESTAMPTZ,
        review_comment    TEXT
      );
      CREATE INDEX ev_event_stages_event ON ev_event_stages (event_id, position);
      CREATE INDEX ev_event_stages_review ON ev_event_stages (company_id, status);

      -- Файлы-доказательства к отчёту по этапу (фото, видео, документы). Отдаются
      -- только через сервис с проверкой доступа — не публичной ссылкой.
      CREATE TABLE ev_stage_files (
        id           SERIAL PRIMARY KEY,
        company_id   INT NOT NULL,
        stage_id     INT NOT NULL REFERENCES ev_event_stages (id) ON DELETE CASCADE,
        stored_name  TEXT NOT NULL UNIQUE,
        original     TEXT NOT NULL,
        mime         TEXT NOT NULL,
        size_bytes   INT NOT NULL CHECK (size_bytes > 0),
        created_by   INT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX ev_stage_files_stage ON ev_stage_files (stage_id);
    `,
  },
  {
    id: 4,
    name: 'настройки компании: целевая маржа и пороги тревог',
    sql: `
      CREATE TABLE ev_settings (
        company_id            INT PRIMARY KEY,
        target_margin_pct     NUMERIC(5, 2) NOT NULL DEFAULT 35 CHECK (target_margin_pct BETWEEN 0 AND 100),
        payment_overdue_days  INT NOT NULL DEFAULT 3  CHECK (payment_overdue_days BETWEEN 0 AND 365),
        rental_overdue_days   INT NOT NULL DEFAULT 1  CHECK (rental_overdue_days BETWEEN 0 AND 365),
        deficit_horizon_days  INT NOT NULL DEFAULT 14 CHECK (deficit_horizon_days BETWEEN 1 AND 365),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
];

async function migrate(db, log = console.log) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ev_migrations (
      id          INT PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const { rows } = await db.query('SELECT id FROM ev_migrations');
  const applied = new Set(rows.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    try {
      await db.tx(async (t) => {
        for (const stmt of splitStatements(m.sql)) await t.query(stmt);
        await t.query('INSERT INTO ev_migrations (id, name) VALUES ($1, $2)', [m.id, m.name]);
      });
      log(`events-api: миграция ${m.id} применена — ${m.name}`);
    } catch (error) {
      error.message = `миграция ${m.id} («${m.name}») не применилась: ${error.message}`;
      throw error;
    }
  }
}

// Делим пакет DDL на отдельные команды: PGlite не принимает несколько команд в
// одном query() с параметрическим протоколом. Комментарии снимаем ДО разбиения —
// иначе «;» внутри комментария разрезал бы команду пополам. В схеме нет функций
// и строковых литералов с «;» или «--», поэтому такого разбора достаточно.
function splitStatements(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { MIGRATIONS, migrate, splitStatements };
