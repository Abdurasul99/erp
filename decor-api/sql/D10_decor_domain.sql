-- =====================================================================
-- Wave · сфера «Декор» (Dora Decor): доменные таблицы    файл: D10_decor_domain.sql
--
-- Центральный объект — ЗАКАЗ (событие), а не товар. Все таблицы с префиксом decor_ и полем company_id.
-- Связи внутри компании — составными ключами (company_id, id): заказ не может сослаться на вещь
-- или сотрудника другой компании, даже если в API ошибка.
-- Деньги — доллары. В сумах вводятся только расходники и ремонт/стирка; в доллары их переводит
-- один курс компании (decor_settings.rate_uzs).
-- Формулы (износ, недостача, себестоимость, бронь) — в backend/decor/formulas.js, не в SQL.
-- =====================================================================

-- ---------- Настройки компании: курс, нормы, постоянные расходы, бронь, панель ----------
CREATE TABLE decor_settings (
  company_id      INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  rate_uzs        NUMERIC(14,2) NOT NULL DEFAULT 12300  CHECK (rate_uzs > 0),          -- сум за 1 $
  transport_usd   NUMERIC(12,2) NOT NULL DEFAULT 50     CHECK (transport_usd >= 0),    -- транспорт на заказ (по умолчанию)
  consumables_uzs NUMERIC(14,2) NOT NULL DEFAULT 170000 CHECK (consumables_uzs >= 0),  -- расходники на заказ (по умолчанию)
  target_usd      NUMERIC(12,2) NOT NULL DEFAULT 250    CHECK (target_usd >= 0),       -- таргет (реклама) в месяц
  repair_uzs      NUMERIC(14,2) NOT NULL DEFAULT 750000 CHECK (repair_uzs >= 0),       -- ремонт и стирка в месяц
  other_fixed_usd NUMERIC(12,2) NOT NULL DEFAULT 0      CHECK (other_fixed_usd >= 0),  -- прочие постоянные в месяц
  expected_orders INT           NOT NULL DEFAULT 10     CHECK (expected_orders >= 1),  -- ожидаемое число заказов в месяц
  -- N «дней на объекте»: заказ держит вещи с event_date по event_date + N (1 — демонтаж на следующий день)
  days_on_site    INT           NOT NULL DEFAULT 1      CHECK (days_on_site BETWEEN 0 AND 30),
  panel_off       TEXT[]        NOT NULL DEFAULT '{}',  -- разделы, выключенные учредителем («Управление панелью»)
  order_seq       INT           NOT NULL DEFAULT 100,   -- последний выданный номер заказа: следующий D-101, D-102 …
  updated_at      TIMESTAMP DEFAULT NOW(),
  updated_by      INT REFERENCES users(id) ON DELETE SET NULL
);

-- ---------- Полномочия: должность × действие ----------
-- Учредитель и ген. директор (founder, gen_dir) могут всё — в таблице не хранятся и не выключаются.
-- Должность = роль пользователя: cashier (кассир), warehouse (кладовщик), pm (проект-менеджер).
CREATE TABLE decor_permissions (
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position   VARCHAR(20) NOT NULL CHECK (position IN ('cashier','warehouse','pm')),
  action     VARCHAR(30) NOT NULL CHECK (action IN (
               'create_order',    -- оформлять заказы (калькулятор)
               'change_status',   -- менять статус заказа
               'handle_decor',    -- выдавать и принимать декор
               'take_money',      -- принимать деньги от клиента
               'confirm_money',   -- подтверждать деньги (касса)
               'upload_report',   -- загружать отчёты
               'approve_report',  -- одобрять отчёты
               'pay_team',        -- выплачивать сдельную оплату
               'see_finance',     -- видеть себестоимость и прибыль
               'edit_settings')), -- менять настройки
  allowed    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (company_id, position, action)
);

-- ---------- Сотрудники и ставки сдельной оплаты ----------
-- Уровень: pm — ПМ, trainee — ученик, cashier — кассир, storekeeper — кладовщик.
-- Вход в систему (user_id) есть не у всех: ученику он не нужен.
CREATE TABLE decor_employees (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(40),
  level      VARCHAR(20) NOT NULL CHECK (level IN ('pm','trainee','cashier','storekeeper')),
  user_id    INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, id)
);

-- Ставка за заказ по уровню и типу заказа (big — большой двор, small — малый)
CREATE TABLE decor_pay_rates (
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level      VARCHAR(20) NOT NULL CHECK (level IN ('pm','trainee','cashier','storekeeper')),
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('big','small')),
  amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  PRIMARY KEY (company_id, level, order_type)
);

-- ---------- Декор ----------
-- Износ за 1 заказ = price_usd / resource_orders.
CREATE TABLE decor_items (
  id              SERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,
  qty_bought      INT NOT NULL DEFAULT 0 CHECK (qty_bought >= 0),
  price_usd       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  resource_orders INT NOT NULL DEFAULT 1 CHECK (resource_orders >= 1),   -- сколько заказов выдерживает
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX decor_items_name_uq ON decor_items (company_id, lower(name));

-- ---------- Заказы ----------
-- Статусы канбана: lead → design → prepay → booked → install → acceptance → dismantle → closed
--                 (Лид → Дизайн → Предоплата → Забронирован → Монтаж → Приёмка → Демонтаж → Закрыт)
CREATE TABLE decor_orders (
  id               SERIAL PRIMARY KEY,
  company_id       INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id        INT REFERENCES branches(id) ON DELETE SET NULL,
  no               VARCHAR(20) NOT NULL,                     -- D-101
  client           VARCHAR(160) NOT NULL,
  phone            VARCHAR(40),
  address          TEXT,
  event_date       DATE NOT NULL,
  type             VARCHAR(10) NOT NULL CHECK (type IN ('big','small')),
  status           VARCHAR(20) NOT NULL DEFAULT 'lead' CHECK (status IN
                     ('lead','design','prepay','booked','install','acceptance','dismantle','closed')),
  price_usd        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  -- прочие расходы заказа (по умолчанию — из настроек, после заказа вписывается факт)
  transport_usd    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (transport_usd >= 0),
  consumables_uzs  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (consumables_uzs >= 0),
  rented_decor_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rented_decor_usd >= 0),   -- декор у других студий
  other_usd        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_usd >= 0),
  note             TEXT,
  created_by       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  -- Снимок при закрытии (решение 2026-10-22): полная раскладка себестоимости на момент закрытия,
  -- включая курс и долю постоянных. Смена курса, норм, ставок и цен вещей закрытый заказ не меняет.
  closed_at        TIMESTAMP,
  closed_by        INT REFERENCES users(id) ON DELETE SET NULL,
  closed_cost      JSONB,
  UNIQUE (company_id, id),
  UNIQUE (company_id, no),
  CONSTRAINT decor_orders_closed_snapshot CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND closed_cost IS NOT NULL))
);
CREATE INDEX decor_orders_date ON decor_orders (company_id, event_date);
CREATE INDEX decor_orders_status ON decor_orders (company_id, status);

-- Команда заказа (из её уровней считается сдельная оплата)
CREATE TABLE decor_order_team (
  company_id  INT NOT NULL,
  order_id    INT NOT NULL,
  employee_id INT NOT NULL,
  PRIMARY KEY (order_id, employee_id),
  FOREIGN KEY (company_id, order_id)    REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, employee_id) REFERENCES decor_employees (company_id, id)
);

-- Дизайн заказа: что запланировано. Это же бронь вещей на период заказа.
CREATE TABLE decor_order_lines (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  order_id   INT NOT NULL,
  item_id    INT NOT NULL,
  qty        INT NOT NULL CHECK (qty > 0),
  UNIQUE (order_id, item_id),
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, item_id)  REFERENCES decor_items (company_id, id)
);
CREATE INDEX decor_order_lines_item ON decor_order_lines (company_id, item_id);

-- ---------- Движение декора по заказу ----------
-- issue — выдача по заявке; extra — довыдача; left — возврат остатка (не использовали, износа нет);
-- final — финальный возврат после демонтажа. На объекте = issue + extra − left − final.
CREATE TABLE decor_moves (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  order_id   INT NOT NULL,
  item_id    INT NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('issue','extra','left','final')),
  qty        INT NOT NULL CHECK (qty > 0),
  move_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, item_id)  REFERENCES decor_items (company_id, id)
);
CREATE INDEX decor_moves_order ON decor_moves (order_id, item_id);
CREATE INDEX decor_moves_item ON decor_moves (company_id, item_id);

-- ---------- Деньги от клиента ----------
-- kind: prepay — предоплата, final — окончательная, topup — доплата.
-- received_by_employee_id NULL — приняла касса (сразу confirmed); иначе деньги у сотрудника:
-- at_pm (у ПМ) → handed (сдал кассиру) → confirmed (касса подтвердила). Подтверждает только касса.
CREATE TABLE decor_payments (
  id                      SERIAL PRIMARY KEY,
  company_id              INT NOT NULL,
  order_id                INT NOT NULL,
  amount_usd              NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0),
  kind                    VARCHAR(10) NOT NULL CHECK (kind IN ('prepay','final','topup')),
  received_by_employee_id INT,
  status                  VARCHAR(10) NOT NULL CHECK (status IN ('at_pm','handed','confirmed')),
  pay_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by              INT REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMP DEFAULT NOW(),
  handed_at               TIMESTAMP,
  handed_by               INT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at            TIMESTAMP,
  confirmed_by            INT REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, received_by_employee_id) REFERENCES decor_employees (company_id, id),
  CONSTRAINT decor_payments_cashbox_confirmed CHECK (received_by_employee_id IS NOT NULL OR status = 'confirmed')
);
CREATE INDEX decor_payments_order ON decor_payments (order_id);
CREATE INDEX decor_payments_open ON decor_payments (company_id, received_by_employee_id) WHERE status <> 'confirmed';

-- ---------- Отчёты с объекта (фото и видео) ----------
-- stage: install — Монтаж, acceptance — Приёмка, dismantle — Демонтаж.
-- Одобрение «Приёмки» создаёт сдельные начисления команде (decor_payroll).
CREATE TABLE decor_reports (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  order_id    INT NOT NULL,
  stage       VARCHAR(12) NOT NULL CHECK (stage IN ('install','acceptance','dismantle')),
  employee_id INT,                                   -- исполнитель (из команды заказа)
  comment     TEXT,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','returned')),
  reply       TEXT,                                  -- комментарий учредителя при одобрении или возврате
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  decided_by  INT REFERENCES users(id) ON DELETE SET NULL,
  decided_at  TIMESTAMP,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id)    REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, employee_id) REFERENCES decor_employees (company_id, id)
);
CREATE INDEX decor_reports_order ON decor_reports (order_id);
CREATE INDEX decor_reports_pending ON decor_reports (company_id) WHERE status = 'pending';

-- Файлы отчёта лежат на диске сервера (папка компании), в базе — только описание
CREATE TABLE decor_report_files (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  report_id     INT NOT NULL,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('image','video')),
  file_name     VARCHAR(255) NOT NULL,               -- имя файла внутри папки компании
  original_name VARCHAR(255),
  mime          VARCHAR(100),
  size_bytes    BIGINT,
  created_at    TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (company_id, report_id) REFERENCES decor_reports (company_id, id) ON DELETE CASCADE
);

-- ---------- Сдельная оплата ----------
-- Одно начисление на сотрудника за заказ. Уровень и тип заказа запоминаются на момент начисления.
CREATE TABLE decor_payroll (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  order_id    INT NOT NULL,
  employee_id INT NOT NULL,
  level       VARCHAR(20) NOT NULL,
  order_type  VARCHAR(10) NOT NULL,
  amount_usd  NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
  status      VARCHAR(10) NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid')),
  report_id   INT,                                   -- одобренная «Приёмка», от которой начислено
  created_at  TIMESTAMP DEFAULT NOW(),
  paid_at     TIMESTAMP,
  paid_by     INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (order_id, employee_id),
  FOREIGN KEY (company_id, order_id)    REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, employee_id) REFERENCES decor_employees (company_id, id),
  FOREIGN KEY (company_id, report_id)   REFERENCES decor_reports (company_id, id)
);
CREATE INDEX decor_payroll_employee ON decor_payroll (company_id, employee_id, status);

INSERT INTO schema_migrations(version) VALUES ('D10_decor_domain') ON CONFLICT DO NOTHING;
