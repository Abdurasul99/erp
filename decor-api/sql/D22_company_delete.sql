-- =====================================================================
-- Wave · сфера «Декор»: удаление компании целиком                 файл: D22_company_delete.sql
--
-- Ошибка D10 (найдена 2026-10-24): компанию нельзя было удалить (DELETE companies — в т.ч. из общей админки сфер):
-- каскад удалял сотрудников и вещи раньше, чем ссылающиеся на них строки заказов (команда, дизайн, движения,
-- оплаты, отчёты, начисления), и проверка внешнего ключа срабатывала сразу.
-- Исправление: эти ссылки проверяются в конце транзакции (DEFERRABLE INITIALLY DEFERRED). Защита та же —
-- удалить сотрудника или вещь, которые используются в заказах, нельзя (ошибка при COMMIT), но удаление
-- компании целиком проходит. Данные не меняются.
-- =====================================================================
ALTER TABLE decor_moves       ALTER CONSTRAINT decor_moves_company_id_item_id_fkey                    DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_order_lines ALTER CONSTRAINT decor_order_lines_company_id_item_id_fkey              DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_order_team  ALTER CONSTRAINT decor_order_team_company_id_employee_id_fkey           DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_payments    ALTER CONSTRAINT decor_payments_company_id_received_by_employee_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_payroll     ALTER CONSTRAINT decor_payroll_company_id_employee_id_fkey              DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_payroll     ALTER CONSTRAINT decor_payroll_company_id_report_id_fkey                DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE decor_reports     ALTER CONSTRAINT decor_reports_company_id_employee_id_fkey              DEFERRABLE INITIALLY DEFERRED;

INSERT INTO schema_migrations(version) VALUES ('D22_company_delete') ON CONFLICT DO NOTHING;
