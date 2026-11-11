-- =====================================================================
-- Wave · сфера «Декор»: клиенты для повторных продаж           файл: D28_clients.sql
--
-- ТЗ «Декор, обновление 2», раздел 1. Клиент — человек с телефоном (один телефон — один клиент в компании),
-- его родственники (дни рождения, «не в браке» — будущие свадьбы) и заказы (decor_orders.client_id).
-- Число заказов, сумма, последний заказ, новый/повторный — считаются из заказов, не хранятся.
--   phone_key — последние 9 цифр телефона: «+998 90 123-45-67» и «901234567» — один клиент.
--   birth_date у клиента — в ТЗ поля нет, но «Ближайшие даты» считают день рождения клиента.
-- Старые заказы к клиентам привязываются отдельно (отчёт «что будет привязано» → подтверждение учредителя),
-- эта миграция их не трогает: только новые таблицы и пустое поле client_id.
-- Ссылка заказа на клиента проверяется в конце транзакции (как в D22) — компания удаляется целиком.
-- =====================================================================
CREATE TABLE decor_clients (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(160) NOT NULL,
  phone      VARCHAR(40) NOT NULL,
  phone_key  VARCHAR(20) NOT NULL,
  phone2     VARCHAR(40),
  address    TEXT,
  birth_date DATE,
  source     VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (source IN ('instagram','recommendation','repeat','other')),
  notes      TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX decor_clients_phone ON decor_clients (company_id, phone_key);
CREATE INDEX decor_clients_name ON decor_clients (company_id, lower(name));

-- Родственники клиента: сын, дочь, брат, сестра, племянник/ца, другое
CREATE TABLE decor_client_relatives (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL,
  client_id             INT NOT NULL,
  relation              VARCHAR(20) NOT NULL CHECK (relation IN ('son','daughter','brother','sister','nephew','other')),
  name                  VARCHAR(160) NOT NULL,
  birth_date            DATE,
  not_married           BOOLEAN NOT NULL DEFAULT false,
  expected_wedding_year SMALLINT CHECK (expected_wedding_year BETWEEN 2000 AND 2100),
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, client_id) REFERENCES decor_clients (company_id, id) ON DELETE CASCADE
);
CREATE INDEX decor_client_relatives_client ON decor_client_relatives (client_id);

ALTER TABLE decor_orders ADD COLUMN client_id INT;
ALTER TABLE decor_orders ADD CONSTRAINT decor_orders_client_fkey
  FOREIGN KEY (company_id, client_id) REFERENCES decor_clients (company_id, id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX decor_orders_client ON decor_orders (client_id) WHERE client_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES ('D28_clients') ON CONFLICT DO NOTHING;
