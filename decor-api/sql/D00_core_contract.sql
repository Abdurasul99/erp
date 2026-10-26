-- =====================================================================
-- Wave · ядро для базы сферы «Декор» (wave_decor)      файл: D00_core_contract.sql
-- «Контракт админки»: те же таблицы, что в базе учебного центра (07_edu_kod/sql/00_core_schema.sql),
-- поэтому общая админка сфер (sphere_admin.js) работает с базой «Декора» без отдельного кода.
--
-- Единственное отличие от 00_core_schema.sql: в users_role_check роль 'pm' (проект-менеджер)
-- вместо 'teacher'. В базе warehouse ничего не меняется.
-- Схема восстановлена по коду Wave — перед установкой на сервер сверить с
--   pg_dump --schema-only warehouse
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(60) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  address    TEXT,
  phone      VARCHAR(30),
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id         SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  address    TEXT,
  phone      VARCHAR(30),
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- [ИЗМЕНЕНО] роль 'pm' — проект-менеджер «Декора» (решение 2026-10-22, как 'teacher' у учебного центра)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL
                CONSTRAINT users_role_check CHECK (role IN
                ('admin','founder','gen_dir','manager','cashier','warehouse','seller','pm')),
  company_id    INT REFERENCES companies(id) ON DELETE CASCADE,
  branch_id     INT REFERENCES branches(id) ON DELETE SET NULL,
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  is_blocked    BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_by    INT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_founder_per_company ON users(company_id) WHERE role = 'founder';
CREATE UNIQUE INDEX IF NOT EXISTS one_gen_dir_per_company ON users(company_id) WHERE role = 'gen_dir';

CREATE TABLE IF NOT EXISTS company_features (
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature_key VARCHAR(60) NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  plan_tier   VARCHAR(30) DEFAULT 'basic',
  enabled_at  TIMESTAMP DEFAULT NOW(),
  enabled_by  INT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (company_id, feature_key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT,
  username    VARCHAR(50),
  action      VARCHAR(40),
  entity_type VARCHAR(40),
  entity_id   INT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(60),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_change_log (
  id                  SERIAL PRIMARY KEY,
  user_id             INT,
  username            VARCHAR(50),
  old_role            VARCHAR(20),
  new_role            VARCHAR(20),
  changed_by          INT,
  changed_by_username VARCHAR(50),
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_log (
  id                SERIAL PRIMARY KEY,
  user_id           INT REFERENCES users(id) ON DELETE SET NULL,
  company_id        INT REFERENCES companies(id) ON DELETE CASCADE,
  prompt_tokens     INT,
  completion_tokens INT,
  model             VARCHAR(60),
  latency_ms        INT,
  created_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_log_co_user ON ai_chat_log(company_id, user_id, created_at DESC);

INSERT INTO schema_migrations(version) VALUES ('D00_core_contract') ON CONFLICT DO NOTHING;
