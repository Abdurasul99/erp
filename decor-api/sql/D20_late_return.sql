-- =====================================================================
-- Wave · сфера «Декор»: финальный возврат по вещам и поздний возврат   файл: D20_late_return.sql
--
-- Решение 2026-10-22:
--  • финальный возврат делается по каждой вещи; он может быть 0 — «по этой вещи ничего не вернулось»;
--  • недостающее после финала — «недостача под вопросом»: для брони вещи уже нет, в себестоимости — предварительно,
--    окончательно фиксируется в снимке при закрытии заказа;
--  • late_return («поздний возврат») — вещь из недостачи нашлась и её привезли: возвращается на склад,
--    недостача уменьшается, износ — как на финальный возврат.
-- Заменяет промежуточную D20_found (стояла только на локальных базах): движения 'found' переименовываются
-- в 'late_return'. Строки не удаляются.
-- =====================================================================
ALTER TABLE decor_moves DROP CONSTRAINT IF EXISTS decor_moves_type_check;
ALTER TABLE decor_moves DROP CONSTRAINT IF EXISTS decor_moves_qty_check;
ALTER TABLE decor_moves ALTER COLUMN type TYPE VARCHAR(20);   -- 'late_return' длиннее 10 символов
UPDATE decor_moves SET type = 'late_return' WHERE type = 'found';
ALTER TABLE decor_moves ADD CONSTRAINT decor_moves_type_check
  CHECK (type IN ('issue','extra','left','final','late_return'));
ALTER TABLE decor_moves ADD CONSTRAINT decor_moves_qty_check
  CHECK (qty > 0 OR (type = 'final' AND qty = 0));

INSERT INTO schema_migrations(version) VALUES ('D20_late_return') ON CONFLICT DO NOTHING;
