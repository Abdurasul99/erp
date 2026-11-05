-- Полный возврат покупателю падал с 500, и товар не возвращался на склад.
-- Строка продажи хранит остаток после возвратов (POST /api/stock/customer-return уменьшает
-- quantity исходной продажи), после полного возврата он равен 0, а ограничение рабочей базы
-- stock_outcome_qty_positive (quantity > 0) такую строку не пропускало.
-- Ноль разрешаем, отрицательное — по-прежнему нельзя. Данные не меняются. Повторный запуск
-- безопасен; то же делает миграция 024_prod_compat ветки Pharma.
--
-- Запуск (от postgres — ограничение меняет только владелец таблицы):
--   sudo -u postgres psql warehouse -v ON_ERROR_STOP=1 -f backend/scripts/fix-full-return.sql
BEGIN;
ALTER TABLE stock_outcome DROP CONSTRAINT IF EXISTS stock_outcome_qty_positive;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'stock_outcome_qty_nonneg' AND conrelid = 'stock_outcome'::regclass) THEN
    ALTER TABLE stock_outcome ADD CONSTRAINT stock_outcome_qty_nonneg CHECK (quantity >= 0);
  END IF;
END$$;
COMMIT;

\echo 'Проверки количества в stock_outcome теперь:'
SELECT conname, pg_get_constraintdef(oid) AS rule
  FROM pg_constraint
 WHERE conrelid = 'stock_outcome'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%quantity%';
