-- Базы и роли для сервиса «Мероприятия» (events-api) на сервере.
--
-- Выполнить ОДИН раз под суперпользователем postgres, подставив пароли:
--
--   sudo -u postgres psql \
--     -v events_app_pass='ПАРОЛЬ-1' \
--     -v events_identity_pass='ПАРОЛЬ-2' \
--     -f setup-prod.sql
--
-- ВАЖНО — порядок: запускать ПОСЛЕ того, как обновлённый backend Wave хоть раз
-- стартовал. Столбец companies.product создаёт его миграция, а право на чтение
-- несуществующего столбца база выдать откажется.
--
-- Скрипт ничего не меняет в данных и правах Wave: он создаёт новую базу, две
-- новые роли и выдаёт одной из них право ЧИТАТЬ несколько столбцов учёток.
--
-- Что получается:
--   events_app       — владелец отдельной базы events. Все данные мероприятий
--                      живут там; к базе warehouse у этой роли доступа нет.
--   events_identity  — подключается к warehouse и видит ТОЛЬКО столбцы входа:
--                      логин, роль, компанию, филиал, сессию, блокировку, имя.
--                      Хэши паролей, продажи, касса, склад Wave ей недоступны —
--                      это ограничение базы, а не обещание в коде.
--
-- Список столбцов ниже — источник правды: тест
-- events-api/test/identity-grants.test.js прогоняет под этими правами все
-- запросы сервиса к учёткам и проверяет, что к данным Wave доступа нет.

-- ── 1. Роль и база сервиса ──────────────────────────────────────────────────
CREATE ROLE events_app LOGIN PASSWORD :'events_app_pass';
CREATE DATABASE events OWNER events_app ENCODING 'UTF8' TEMPLATE template0;

\connect events
-- Схема public в новой базе принадлежит postgres; отдаём её сервису, чтобы
-- миграции events-api создавали таблицы и после обновления PostgreSQL до 15+,
-- где право CREATE в public по умолчанию снято.
ALTER SCHEMA public OWNER TO events_app;

-- ── 2. Роль учёток: только чтение, только столбцы входа ────────────────────
\connect warehouse
CREATE ROLE events_identity LOGIN PASSWORD :'events_identity_pass';
-- IDENTITY-GRANTS-BEGIN
GRANT CONNECT ON DATABASE warehouse TO events_identity;
GRANT USAGE ON SCHEMA public TO events_identity;
GRANT SELECT (id, username, role, company_id, branch_id, session_id, is_blocked, first_name, last_name) ON users TO events_identity;
GRANT SELECT (id, name, is_enabled, product, logo_url) ON companies TO events_identity;
GRANT SELECT (id, name, company_id) ON branches TO events_identity;
-- IDENTITY-GRANTS-END

-- Замечание. В PostgreSQL 14 у роли PUBLIC по умолчанию есть право CREATE в
-- схеме public базы warehouse — значит, events_identity технически может там
-- СОЗДАТЬ свою таблицу (читать чужие — нет). Снимать это право у PUBLIC здесь
-- не стали: на нём держатся миграции Wave (ensureSchema создаёт таблицы от
-- wareapp_user). Если захотите закрыть и это — сначала выдайте wareapp_user
-- явное право CREATE ON SCHEMA public, затем REVOKE CREATE ... FROM PUBLIC.
