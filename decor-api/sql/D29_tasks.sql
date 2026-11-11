-- =====================================================================
-- Wave · сфера «Декор»: задачи и матрица Эйзенхауэра           файл: D29_tasks.sql
--
-- ТЗ «Декор, обновление 2», раздел 2 (раздел «Управление»). Квадрат матрицы — поля urgent + important;
-- канбан — по статусам new → in_progress → review → done. Сотрудник видит свои задачи, учредитель — все.
-- Просроченные (срок прошёл, статус не done) — в подсказках на Главной.
-- Автозадачи по клиентам (source = auto_client_date): за 7 дней до дня рождения клиента или родственника и до
-- годовщины свадьбы — кассиру «позвонить и предложить». auto_key (вид + кто + дата) уникален в компании:
-- одна задача на одну дату в год, повторный запуск дубля не создаёт.
-- Новые полномочия: assign_tasks «ставить задачи», accept_tasks «принимать выполненные задачи» —
-- по умолчанию ни у одной должности. Только новые таблица и права; существующие данные не меняются.
-- =====================================================================
CREATE TABLE decor_tasks (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  due_date    DATE,
  urgent      BOOLEAN NOT NULL DEFAULT false,
  important   BOOLEAN NOT NULL DEFAULT false,
  status      VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','review','done')),
  order_id    INT,
  client_id   INT,
  source      VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto_client_date')),
  -- автозадача: что за дата (день рождения клиента / родственника, годовщина свадьбы), чья и когда
  auto_key    VARCHAR(80),
  auto_kind   VARCHAR(20) CHECK (auto_kind IN ('client_birthday','relative_birthday','anniversary')),
  relative_id INT,
  event_date  DATE,
  result      TEXT,                                  -- итог: «дозвонился», «договорились» и т.п.
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  done_at     TIMESTAMP,
  done_by     INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (company_id, id),
  CONSTRAINT decor_tasks_done CHECK ((status = 'done') = (done_at IS NOT NULL)),
  CONSTRAINT decor_tasks_auto CHECK ((source = 'auto_client_date') = (auto_key IS NOT NULL)),
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, client_id) REFERENCES decor_clients (company_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX decor_tasks_auto_key ON decor_tasks (company_id, auto_key) WHERE auto_key IS NOT NULL;
CREATE INDEX decor_tasks_assignee ON decor_tasks (company_id, assignee_id);
CREATE INDEX decor_tasks_open ON decor_tasks (company_id, due_date) WHERE status <> 'done';

-- ---------- Права assign_tasks и accept_tasks ----------
ALTER TABLE decor_permissions DROP CONSTRAINT decor_permissions_action_check;
ALTER TABLE decor_permissions ADD CONSTRAINT decor_permissions_action_check CHECK (action IN (
  'create_order', 'change_status', 'handle_decor', 'take_money', 'confirm_money',
  'upload_report', 'approve_report', 'pay_team', 'see_finance', 'edit_settings', 'manage_items',
  'edit_values', 'assign_tasks', 'accept_tasks'));

INSERT INTO decor_permissions (company_id, position, action, allowed)
SELECT s.company_id, p.position, a.action, false
FROM decor_settings s CROSS JOIN (VALUES ('cashier'), ('warehouse'), ('pm')) AS p(position)
CROSS JOIN (VALUES ('assign_tasks'), ('accept_tasks')) AS a(action)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('D29_tasks') ON CONFLICT DO NOTHING;
