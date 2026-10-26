-- =====================================================================
-- Wave · сфера «Декор»: поздний возврат после закрытия заказа   файл: D21_returned_after_close.sql
--
-- Решение 2026-10-24: вещь из списанной недостачи нашлась после закрытия заказа — она возвращается на склад,
-- снимок себестоимости закрытого заказа НЕ меняется, а движение помечается «возвращено после закрытия»
-- с суммой (кол-во × цена вещи из снимка при закрытии). Так в отчётах видно, сколько реально нашлось из недостачи.
-- Миграция только добавляет поля, данные не меняются.
-- =====================================================================
ALTER TABLE decor_moves ADD COLUMN after_close BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE decor_moves ADD COLUMN amount_usd NUMERIC(12,2);
ALTER TABLE decor_moves ADD CONSTRAINT decor_moves_after_close_check
  CHECK (NOT after_close OR (type = 'late_return' AND amount_usd IS NOT NULL AND amount_usd >= 0));

INSERT INTO schema_migrations(version) VALUES ('D21_returned_after_close') ON CONFLICT DO NOTHING;
