-- =====================================================================
-- Wave · сфера «Декор»: готовые дизайны                             файл: D26_designs.sql
--
-- Решение владельца 09.11.2026: на складе — не только вещи поштучно, но и дизайны. Дизайн — название
-- и состав: какие вещи и сколько штук каждой («готовое количество» внутри дизайна). В калькуляторе
-- дизайн добавляет в заказ все свои вещи разом; недостающие материалы добавляются вещами сверху.
-- Остатки по-прежнему считаются по вещам — дизайн ничего не бронирует и не списывает сам.
-- Дизайны не удаляются (их могли брать в заказы) — выключаются (is_active=false, «архив»).
-- Только новые таблицы: существующие данные не меняются.
-- =====================================================================

CREATE TABLE decor_designs (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  note        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Два действующих дизайна с одним названием в компании — путаница в калькуляторе
CREATE UNIQUE INDEX decor_designs_name ON decor_designs (company_id, lower(name)) WHERE is_active;

CREATE TABLE decor_design_lines (
  design_id  INT NOT NULL REFERENCES decor_designs(id) ON DELETE CASCADE,
  item_id    INT NOT NULL REFERENCES decor_items(id) ON DELETE CASCADE,   -- вещи не удаляются (архив), только с компанией
  qty        INT NOT NULL CHECK (qty > 0),
  PRIMARY KEY (design_id, item_id)
);
CREATE INDEX decor_design_lines_item ON decor_design_lines (item_id);

INSERT INTO schema_migrations(version) VALUES ('D26_designs') ON CONFLICT DO NOTHING;
