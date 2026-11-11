-- =====================================================================
-- Wave · сфера «Декор»: стандарты работ — пошаговые чек-листы    файл: D30_standards.sql
--
-- ТЗ «Декор, обновление 2», раздел 3. Стандарт (вход, стол, стена из ткани, тент…) — шаги по порядку, у шага
-- может быть фото-образец и отметка «нужно фото». Создаёт и меняет стандарты учредитель (новое полномочие
-- edit_standards «менять стандарты работ» — по умолчанию ни у одной должности). Стандарты создаются пустыми.
-- В заказе выбирают виды работ (decor_order_works) — шаги КОПИРУЮТСЯ в заказ (decor_order_step_done: копия текста,
-- образца и «нужно фото» + кто и когда отметил, фото). Изменение стандарта не меняет уже выбранные чек-листы.
-- Фото образцов и отметок лежат там же, где фото отчётов (decor_report_files): у файла теперь ровно один владелец
-- из четырёх — отчёт, доказательство, отметка шага или стандарт (образец).
-- Только новые таблицы, поля и право; существующие данные не меняются.
-- =====================================================================
CREATE TABLE decor_standards (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(160) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX decor_standards_name ON decor_standards (company_id, lower(name)) WHERE active;

CREATE TABLE decor_standard_steps (
  id             SERIAL PRIMARY KEY,
  company_id     INT NOT NULL,
  standard_id    INT NOT NULL,
  position       INT NOT NULL CHECK (position >= 1),
  text           TEXT NOT NULL,
  sample_photo   INT,                                -- файл-образец (decor_report_files.id этого стандарта)
  photo_required BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (standard_id, position),
  FOREIGN KEY (company_id, standard_id) REFERENCES decor_standards (company_id, id) ON DELETE CASCADE
);

-- Виды работ заказа: стандарт и его название на момент выбора
CREATE TABLE decor_order_works (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  order_id    INT NOT NULL,
  standard_id INT NOT NULL,
  name        VARCHAR(160) NOT NULL,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id),
  UNIQUE (order_id, standard_id),
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, standard_id) REFERENCES decor_standards (company_id, id) DEFERRABLE INITIALLY DEFERRED
);

-- Шаги чек-листа заказа: копия шага при выборе работы + отметка (кто, когда, фото)
CREATE TABLE decor_order_step_done (
  id             SERIAL PRIMARY KEY,
  company_id     INT NOT NULL,
  order_id       INT NOT NULL,
  work_id        INT NOT NULL,
  position       INT NOT NULL CHECK (position >= 1),
  step           TEXT NOT NULL,                      -- копия текста шага
  sample_photo   INT,                                -- копия ссылки на образец
  photo_required BOOLEAN NOT NULL DEFAULT false,
  done_by        INT REFERENCES users(id) ON DELETE SET NULL,
  done_at        TIMESTAMP,
  photo          INT,                                -- первое фото отметки (все — в decor_report_files.step_done_id)
  UNIQUE (company_id, id),
  UNIQUE (work_id, position),
  FOREIGN KEY (company_id, work_id) REFERENCES decor_order_works (company_id, id) ON DELETE CASCADE
);
CREATE INDEX decor_order_step_done_order ON decor_order_step_done (order_id);

-- ---------- Файлы: отметка шага и образец стандарта ----------
ALTER TABLE decor_report_files ADD COLUMN step_done_id INT;
ALTER TABLE decor_report_files ADD COLUMN standard_id INT;
ALTER TABLE decor_report_files ADD CONSTRAINT decor_report_files_step_done_fkey
  FOREIGN KEY (company_id, step_done_id) REFERENCES decor_order_step_done (company_id, id) ON DELETE CASCADE;
ALTER TABLE decor_report_files ADD CONSTRAINT decor_report_files_standard_fkey
  FOREIGN KEY (company_id, standard_id) REFERENCES decor_standards (company_id, id) ON DELETE CASCADE;
ALTER TABLE decor_report_files DROP CONSTRAINT decor_report_files_owner;
ALTER TABLE decor_report_files ADD CONSTRAINT decor_report_files_owner
  CHECK (num_nonnulls(report_id, evidence_id, step_done_id, standard_id) = 1);
CREATE INDEX decor_report_files_step_done ON decor_report_files (step_done_id) WHERE step_done_id IS NOT NULL;
CREATE INDEX decor_report_files_standard ON decor_report_files (standard_id) WHERE standard_id IS NOT NULL;

-- ---------- Право edit_standards ----------
ALTER TABLE decor_permissions DROP CONSTRAINT decor_permissions_action_check;
ALTER TABLE decor_permissions ADD CONSTRAINT decor_permissions_action_check CHECK (action IN (
  'create_order', 'change_status', 'handle_decor', 'take_money', 'confirm_money',
  'upload_report', 'approve_report', 'pay_team', 'see_finance', 'edit_settings', 'manage_items',
  'edit_values', 'assign_tasks', 'accept_tasks', 'edit_standards'));

INSERT INTO decor_permissions (company_id, position, action, allowed)
SELECT s.company_id, p.position, 'edit_standards', false
FROM decor_settings s CROSS JOIN (VALUES ('cashier'), ('warehouse'), ('pm')) AS p(position)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('D30_standards') ON CONFLICT DO NOTHING;
