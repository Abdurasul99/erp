-- =====================================================================
-- Wave · сфера «Декор»: доказательства (фото/видео) и фонд материалов     файл: D24_evidence_fund.sql
--
-- ОДОБРЕНА пользователем 2026-10-24 (версия 2: покупка пополняет склад, фонд = износ +
-- недостача − возвращено после закрытия, лимиты файлов). ОБЯЗАТЕЛЬНА для экранов Шага 5.
--
-- Шаг 5 (решение пользователя 2026-10-24):
--  1. «Требования к доказательствам» — учредитель для каждого этапа задаёт минимум фото и нужно ли видео.
--     Этапы: issue — выдача со склада, install — монтаж, acceptance — приёмка, dismantle — демонтаж,
--     final — финальный возврат, handover — «сдал кассиру». Для final ещё shortage_note: при недостаче
--     обязателен комментарий или ещё одно фото. Значения по умолчанию ставятся всем существующим компаниям.
--  2. Доказательства действий склада и денег (выдача, финальный возврат, «сдал кассиру») — decor_evidence.
--     Отчёты монтажа, приёмки и демонтажа остаются в decor_reports. Файлы тех и других — в одной таблице
--     decor_report_files (у файла либо report_id, либо evidence_id) и отдаются одним адресом по токену компании.
--     Движение склада помнит своё доказательство (decor_moves.evidence_id).
--  3. «Фонд материалов»: накоплено = износ + окончательная недостача из снимков закрытых заказов
--     − «возвращено после закрытия»; потрачено = покупки (decor_fund_spend, кнопка «Купил декор»);
--     остаток = накоплено − потрачено. Покупка уменьшает и фонд, и кассу. Покупка с вещью пополняет склад:
--     qty_bought вещи += qty (цена и ресурс вещи — по выбору), бронь сразу видит новые вещи; вещь можно
--     создать прямо из окна покупки. Без вещи — просто расход из фонда (например, ремонт).
--  4. Лимиты файлов в настройках компании: фото до 10 МБ, видео до 100 МБ (меняются в Настройках).
-- Миграция только добавляет таблицы, поля и строки по умолчанию. Существующие данные не меняются и не удаляются.
-- =====================================================================

-- ---------- 1. Требования к доказательствам по этапам ----------
CREATE TABLE decor_evidence_rules (
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage         VARCHAR(12) NOT NULL CHECK (stage IN ('issue','install','acceptance','dismantle','final','handover')),
  min_photos    INT NOT NULL DEFAULT 1 CHECK (min_photos BETWEEN 0 AND 9),   -- в одной отправке не больше 10 файлов
  need_video    BOOLEAN NOT NULL DEFAULT false,
  shortage_note BOOLEAN NOT NULL DEFAULT false,      -- только финальный возврат: при недостаче — комментарий или ещё 1 фото
  updated_at    TIMESTAMP DEFAULT NOW(),
  updated_by    INT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (company_id, stage),
  CONSTRAINT decor_evidence_rules_shortage CHECK (stage = 'final' OR NOT shortage_note),
  CONSTRAINT decor_evidence_rules_any CHECK (min_photos > 0 OR need_video)  -- этап без единого файла не бывает
);
-- По умолчанию (слова пользователя): выдача 1 фото; монтаж 1 фото; приёмка 3 фото + 1 видео; демонтаж 1 фото;
-- финальный возврат 1 фото, при недостаче — комментарий или фото; «сдал кассиру» 1 фото чека/перевода
INSERT INTO decor_evidence_rules (company_id, stage, min_photos, need_video, shortage_note)
SELECT s.company_id, d.stage, d.min_photos, d.need_video, d.shortage_note
FROM decor_settings s
CROSS JOIN (VALUES ('issue', 1, false, false), ('install', 1, false, false), ('acceptance', 3, true, false),
                   ('dismantle', 1, false, false), ('final', 1, false, true), ('handover', 1, false, false))
  AS d(stage, min_photos, need_video, shortage_note)
ON CONFLICT DO NOTHING;

-- ---------- 2. Доказательства выдачи, финального возврата и «сдал кассиру» ----------
CREATE TABLE decor_evidence (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  order_id   INT NOT NULL,
  stage      VARCHAR(12) NOT NULL CHECK (stage IN ('issue','final','handover')),
  payment_id INT REFERENCES decor_payments(id) ON DELETE CASCADE,   -- только для «сдал кассиру»
  comment    TEXT,                                                  -- при недостаче на финале — причина
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, order_id) REFERENCES decor_orders (company_id, id) ON DELETE CASCADE,
  CONSTRAINT decor_evidence_payment CHECK ((stage = 'handover') = (payment_id IS NOT NULL))
);
CREATE INDEX decor_evidence_order ON decor_evidence (order_id);
CREATE INDEX decor_evidence_payment_idx ON decor_evidence (payment_id) WHERE payment_id IS NOT NULL;

-- Файлы: у файла либо отчёт, либо доказательство
ALTER TABLE decor_report_files ALTER COLUMN report_id DROP NOT NULL;
ALTER TABLE decor_report_files ADD COLUMN evidence_id INT;
ALTER TABLE decor_report_files ADD CONSTRAINT decor_report_files_evidence_fkey
  FOREIGN KEY (company_id, evidence_id) REFERENCES decor_evidence (company_id, id) ON DELETE CASCADE;
ALTER TABLE decor_report_files ADD CONSTRAINT decor_report_files_owner
  CHECK ((report_id IS NULL) <> (evidence_id IS NULL));
CREATE INDEX decor_report_files_evidence ON decor_report_files (evidence_id) WHERE evidence_id IS NOT NULL;

-- Движение склада → его доказательство (выдача, финальный возврат). Проверка — в конце транзакции,
-- как в D22, чтобы удаление компании целиком проходило.
ALTER TABLE decor_moves ADD COLUMN evidence_id INT;
ALTER TABLE decor_moves ADD CONSTRAINT decor_moves_evidence_fkey
  FOREIGN KEY (company_id, evidence_id) REFERENCES decor_evidence (company_id, id) DEFERRABLE INITIALLY DEFERRED;

-- ---------- 3. Фонд материалов: покупки декора и прочие траты из фонда ----------
-- amount_usd — сколько всего заплатили (уходит из фонда и из кассы). Если указана вещь — qty штук пришло на склад
-- (decor_items.qty_bought += qty в той же транзакции), unit_price_usd — цена за штуку в этой покупке.
-- new_item — вещь заведена этой покупкой (окно «Купил декор» → «новая вещь»).
CREATE TABLE decor_fund_spend (
  id             SERIAL PRIMARY KEY,
  company_id     INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount_usd     NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0),
  comment        TEXT NOT NULL CHECK (length(trim(comment)) > 0),   -- что купили или на что потратили
  item_id        INT,
  qty            INT CHECK (qty > 0),
  unit_price_usd NUMERIC(12,2) CHECK (unit_price_usd >= 0),
  new_item       BOOLEAN NOT NULL DEFAULT false,
  spend_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by     INT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  -- вещь указывается вместе с количеством; без вещи — ни количества, ни цены за штуку
  CONSTRAINT decor_fund_spend_item CHECK ((item_id IS NULL AND qty IS NULL AND unit_price_usd IS NULL AND NOT new_item)
                                       OR (item_id IS NOT NULL AND qty IS NOT NULL)),
  CONSTRAINT decor_fund_spend_item_fkey FOREIGN KEY (company_id, item_id)
    REFERENCES decor_items (company_id, id) DEFERRABLE INITIALLY DEFERRED   -- как в D22: удаление компании проходит
);
CREATE INDEX decor_fund_spend_company ON decor_fund_spend (company_id, spend_date);

-- ---------- 4. Лимиты размера файлов (фото и видео), МБ ----------
ALTER TABLE decor_settings ADD COLUMN photo_max_mb INT NOT NULL DEFAULT 10  CHECK (photo_max_mb BETWEEN 1 AND 50);
ALTER TABLE decor_settings ADD COLUMN video_max_mb INT NOT NULL DEFAULT 100 CHECK (video_max_mb BETWEEN 1 AND 500);

INSERT INTO schema_migrations(version) VALUES ('D24_evidence_fund') ON CONFLICT DO NOTHING;
