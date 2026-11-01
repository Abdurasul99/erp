-- =====================================================================
-- Wave · сфера «Декор»: журнал склада и право «вести склад»          файл: D25_stock_journal.sql
--
-- Этап 1 доработок склада (аудит фронта, 2026-11-01):
--  1. «Куплено» (decor_items.qty_bought) больше не правится голым числом: каждое изменение — операция
--     с причиной в журнале decor_stock_moves. Операции: opening — начальный остаток новой вещи,
--     receipt — приход, writeoff — списание, count — инвентаризация (qty — найденная разница, может быть 0),
--     purchase — покупка из фонда («Купил декор»). Сумма qty по вещи = её qty_bought.
--     Вещам, заведённым до журнала, пишется одна строка opening на весь текущий остаток.
--     Выдача и возврат по заказам остаются в decor_moves (они «Куплено» не меняют).
--  2. Право manage_items — заводить вещи, менять название, убирать в архив, приход, списание, инвентаризация.
--     Цена и ресурс по-прежнему только у «менять настройки». По умолчанию включено кладовщику.
-- Миграция добавляет таблицу, строки журнала и строки полномочий. Существующие данные не меняются и не удаляются.
-- =====================================================================

-- ---------- 1. Журнал склада ----------
CREATE TABLE decor_stock_moves (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id       INT NOT NULL,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('opening','receipt','writeoff','count','purchase')),
  qty           INT NOT NULL,                       -- изменение «Куплено»: + приход, − списание, ± разница инвентаризации
  qty_after     INT NOT NULL CHECK (qty_after >= 0),-- «Куплено» после операции
  counted       INT CHECK (counted >= 0),           -- инвентаризация: сколько насчитали на складе
  expected      INT,                                -- инвентаризация: сколько должно было быть на складе по системе
  comment       TEXT,
  fund_spend_id INT REFERENCES decor_fund_spend(id) ON DELETE SET NULL,
  user_id       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT decor_stock_moves_sign CHECK (
       (kind = 'opening'  AND qty >= 0)
    OR (kind IN ('receipt','purchase') AND qty > 0)
    OR (kind = 'writeoff' AND qty < 0)
    OR (kind = 'count'    AND counted IS NOT NULL AND expected IS NOT NULL AND qty = counted - expected)),
  -- как в D22/D24: вещь с историей не удалить, а удаление компании целиком проходит
  CONSTRAINT decor_stock_moves_item_fkey FOREIGN KEY (company_id, item_id)
    REFERENCES decor_items (company_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX decor_stock_moves_item ON decor_stock_moves (company_id, item_id, id);
CREATE INDEX decor_stock_moves_company ON decor_stock_moves (company_id, id);

INSERT INTO decor_stock_moves (company_id, item_id, kind, qty, qty_after, comment, created_at)
SELECT company_id, id, 'opening', qty_bought, qty_bought, 'Остаток до журнала склада', COALESCE(created_at, NOW())
FROM decor_items;

-- ---------- 2. Право manage_items ----------
ALTER TABLE decor_permissions DROP CONSTRAINT decor_permissions_action_check;
ALTER TABLE decor_permissions ADD CONSTRAINT decor_permissions_action_check CHECK (action IN (
  'create_order', 'change_status', 'handle_decor', 'take_money', 'confirm_money',
  'upload_report', 'approve_report', 'pay_team', 'see_finance', 'edit_settings', 'manage_items'));

-- Полная матрица у каждой компании «Декора» (у кого есть настройки): кладовщику — включено, остальным — нет
INSERT INTO decor_permissions (company_id, position, action, allowed)
SELECT s.company_id, p.position, 'manage_items', p.position = 'warehouse'
FROM decor_settings s CROSS JOIN (VALUES ('cashier'), ('warehouse'), ('pm')) AS p(position)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('D25_stock_journal') ON CONFLICT DO NOTHING;
