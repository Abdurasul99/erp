-- =====================================================================
-- Wave · сфера «Декор»: «Кадрият» — ценности компании          файл: D27_values.sql
--
-- ТЗ «Декор, обновление 2», раздел 4. Шесть кнопок на Главной у всех должностей и на странице входа;
-- нажатие — окно с названием и текстом «что это означает» (RU / UZ). Тексты пишет и меняет учредитель сам
-- (Настройки → Кадрият), новое полномочие «менять Кадрият» (edit_values) — по умолчанию ни у одной должности
-- (учредитель и ген. директор могут всё, как во всех полномочиях «Декора»).
-- Названия шести ценностей заводятся сразу, тексты — пустые. Только новые таблица, строки и право;
-- существующие данные не меняются.
-- =====================================================================
CREATE TABLE decor_values (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position   SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 6),     -- порядок кнопок
  title_uz   VARCHAR(120) NOT NULL,
  title_ru   VARCHAR(120) NOT NULL,
  text_uz    TEXT NOT NULL DEFAULT '',
  text_ru    TEXT NOT NULL DEFAULT '',
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, position)
);

-- Шесть начальных ценностей у каждой компании «Декора» (у кого есть настройки); новые компании получают их при создании
INSERT INTO decor_values (company_id, position, title_uz, title_ru)
SELECT s.company_id, v.position, v.title_uz, v.title_ru
FROM decor_settings s CROSS JOIN (VALUES
  (1, 'Mardlik', 'Смелость'),
  (2, 'Stabillik', 'Стабильность'),
  (3, 'Yangilikka tayyor bo‘lish', 'Готовность к новому'),
  (4, 'Halollik', 'Честность'),
  (5, 'Adolatlilik', 'Справедливость'),
  (6, 'Natijaviylik', 'Результативность')) AS v(position, title_uz, title_ru)
ON CONFLICT DO NOTHING;

-- ---------- Право edit_values («менять Кадрият») ----------
ALTER TABLE decor_permissions DROP CONSTRAINT decor_permissions_action_check;
ALTER TABLE decor_permissions ADD CONSTRAINT decor_permissions_action_check CHECK (action IN (
  'create_order', 'change_status', 'handle_decor', 'take_money', 'confirm_money',
  'upload_report', 'approve_report', 'pay_team', 'see_finance', 'edit_settings', 'manage_items',
  'edit_values'));

INSERT INTO decor_permissions (company_id, position, action, allowed)
SELECT s.company_id, p.position, 'edit_values', false
FROM decor_settings s CROSS JOIN (VALUES ('cashier'), ('warehouse'), ('pm')) AS p(position)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('D27_values') ON CONFLICT DO NOTHING;
