-- =====================================================================
-- Одобрена пользователем 2026-10-24. ОБЯЗАТЕЛЬНА: без таблицы /api/decor/health показывает ошибку, а записывающие
-- запросы с ключом повтора отвечают 503 (защита от дублей не выключается молча).
--
-- Wave · сфера «Декор»: защита от повторной отправки (ключ идемпотентности)   файл: D23_idempotency.sql
-- Решение 2026-10-24 (с поправками пользователя):
--  • ключ генерирует клиент один раз на действие и повторяет его при повторах этого же действия (заголовок Idempotency-Key);
--  • request_hash — отпечаток запроса (sha256 метода, адреса и тела): тот же ключ с другим телом → 409, ничего не выполняется;
--  • строка ключа пишется в ТОЙ ЖЕ транзакции, что и само действие: сохраняется всё или ничего
--    (упали посреди действия — нет ни действия, ни ключа, повтор выполнится заново);
--  • повтор с тем же ключом получает первый ответ (response), дубль не создаётся;
--  • status='running' старше 2 минут считается failed — повтор разрешён;
--  • строки старше 30 дней удаляет сервер (при старте и раз в сутки) — по индексу created_at.
-- Только добавляет таблицу и индекс, существующие данные не меняются.
-- =====================================================================
CREATE TABLE decor_idempotency (
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      INT NOT NULL,
  idem_key     VARCHAR(80) NOT NULL,
  method       VARCHAR(10) NOT NULL,
  path         VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,                 -- sha256 (метод + адрес + тело запроса)
  status       VARCHAR(10) NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  result       JSONB,                             -- что сделано (id заказа, оплаты …) — в транзакции действия
  http_status  INT,
  response     JSONB,                             -- тело первого ответа — для повтора
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMP,
  PRIMARY KEY (company_id, user_id, idem_key)
);
CREATE INDEX decor_idempotency_created ON decor_idempotency (created_at);

INSERT INTO schema_migrations(version) VALUES ('D23_idempotency') ON CONFLICT DO NOTHING;
