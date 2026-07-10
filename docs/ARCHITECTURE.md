# 🌊 Wave ERP — Архитектура системы

> Единый документ для **Product Manager** и **System Engineer**.
> Описывает, как устроены Frontend ↔ Backend ↔ Database, как 115 инструментов панели владельца ложатся на API и таблицы, и какие сквозные принципы (мультитенантность, роли, AI-граница данных) удерживают всё вместе.

**Стек:** React 18 + Vite (SPA) · Node.js + Express (монолит) · PostgreSQL · внешний AI-провайдер (OpenAI-совместимый) · Telegram Bot API.
**Масштаб на сегодня:** 115 инструментов в 9 разделах · ~281 HTTP-маршрут · ~80 таблиц БД · 5 ролей пользователей.

---

## 1. Обзор за 30 секунд (для PM)

Wave ERP — это **облачная ERP для розницы** (мультикомпанийная, мультифилиальная). Один владелец (`founder`) заводит компанию, внутри неё — филиалы, в филиалах работают продавцы. Над всем — панель владельца со 115 инструментами: аналитика, финансы, закупки, склад, продажи, персонал, маркетинг, клиентский сервис, настройки. Поверх данных работает встроенный **AI-аналитик**, который отвечает **только по цифрам конкретной компании**.

```mermaid
flowchart LR
    subgraph CLIENT["🖥️ Браузер (SPA)"]
        UI["React + Vite<br/>4 интерфейса по ролям"]
    end
    subgraph SERVER["⚙️ Сервер приложения"]
        API["Express-монолит<br/>~281 маршрут /api/*"]
    end
    subgraph DATA["🗄️ Данные"]
        DB[("PostgreSQL<br/>~80 таблиц")]
    end
    subgraph EXT["☁️ Внешние сервисы"]
        AI["AI-провайдер<br/>(DeepSeek / Groq LLaMA)"]
        TG["Telegram Bot API"]
    end

    UI -- "HTTPS · JSON · JWT" --> API
    API -- "SQL (pg pool)" --> DB
    API -- "прокси, ключ только на сервере" --> AI
    API -- "уведомления / рассылки" --> TG

    classDef c fill:#1D4ED8,color:#fff,stroke:#0B1640;
    classDef s fill:#16A34A,color:#fff,stroke:#064e3b;
    classDef d fill:#D97706,color:#fff,stroke:#7c2d12;
    classDef e fill:#6B7280,color:#fff,stroke:#374151;
    class UI c
    class API s
    class DB d
    class AI,TG e
```

**Главный архитектурный принцип:** браузер никогда не ходит в БД и к AI напрямую. Всё проходит через backend, который проверяет токен, роль и **обрезает данные по `company_id` / `branch_id`** прежде чем что-либо вернуть.

---

## 2. Контейнерная диаграмма (C4 — уровень 2)

Что физически развёрнуто и как взаимодействует.

```mermaid
flowchart TB
    user(["👤 Пользователь<br/>founder · gen_dir · manager · seller · admin"])

    subgraph browser["Браузер"]
        spa["<b>Frontend SPA</b><br/>React 18 · Vite · react-router-dom<br/>axios-клиент с JWT-интерсептором<br/>lazy-загрузка бандла под роль"]
    end

    subgraph host["Прод-хост (mywarehouse.uz)"]
        nginx["<b>Nginx</b><br/>отдаёт статику фронта<br/>проксирует /api → :PORT"]
        node["<b>Node.js / Express</b><br/>pm2: wareapp-api<br/>server.js (~20k строк)<br/>JWT · bcrypt · multer · exceljs · rate-limit"]
        pg[("<b>PostgreSQL</b><br/>мультитенант по company_id<br/>ensureSchema() при старте")]
    end

    ai["☁️ AI-провайдер<br/>OpenAI-совместимый API<br/>ключ в ENV сервера"]
    tg["☁️ Telegram Bot API"]

    user --> spa
    spa -- "GET статика" --> nginx
    spa -- "XHR /api/*" --> nginx
    nginx --> node
    node -- "pg Pool" --> pg
    node -- "fetch + Bearer" --> ai
    node -- "fetch bot/method" --> tg
```

| Контейнер | Технология | Ответственность | Где в репо |
|---|---|---|---|
| **Frontend SPA** | React 18, Vite, react-router-dom, axios | UI, роутинг по ролям, рендер 115 инструментов | [frontend/src/](../frontend/src/) |
| **Backend API** | Node.js, Express (монолит) | Аутентификация, RBAC, бизнес-логика, скоупинг данных, AI-прокси | [backend/server.js](../backend/server.js) |
| **Database** | PostgreSQL (драйвер `pg`) | Хранение всех данных, мультитенант по `company_id` | схема в `ensureSchema()` + [migrations/001_init.sql](../backend/migrations/001_init.sql) |
| **AI-провайдер** | DeepSeek / Groq (внешний) | LLM-разбор по реальным цифрам компании | прокси в `server.js` (`/api/ai/*`) |
| **Telegram** | Bot API (внешний) | Уведомления, клиентские рассылки | `fetch` к `api.telegram.org` |

---

## 3. Frontend — маршрутизация по ролям

Точка входа [App.jsx](../frontend/src/App.jsx) проверяет JWT (`/auth/me`) и разводит пользователя по «оболочке» (shell), соответствующей роли. Каждая оболочка **грузится лениво** — продавец не качает бандл владельца, и наоборот.

```mermaid
flowchart TD
    login["/login<br/>Login.jsx"] --> auth{"JWT валиден?<br/>role = ?"}

    auth -- "founder / gen_dir / manager" --> owner["/owner/*<br/><b>OwnerShell</b>"]
    auth -- "seller" --> sell["/sell<br/>SellerView<br/>(+ выбор филиала на день)"]
    auth -- "admin" --> admin["/admin/*<br/>AdminShell"]

    owner --> shell["OwnerShell.jsx<br/>сайдбар · 9 разделов · AI-Drawer · Dashboard"]
    shell --> router["<b>ToolRouter.jsx</b><br/>sectionId / toolId → компонент"]

    router --> live["🔵 Live-компоненты<br/>(WarehouseBalance, CashReport,<br/>TeamKPI, CustomersManager…)"]
    router --> tools["🟢 Tool-компоненты<br/>frontend/src/owner/tools/*.jsx<br/>(100 готовых)"]
    router --> stub["🟡 ComingSoon / 🚧 макет<br/>(15 заглушек, wired:false)"]
```

**Как инструмент находит свой UI** ([modules.js](../frontend/src/owner/modules.js) + [ToolRouter.jsx](../frontend/src/owner/ToolRouter.jsx)):

1. `modules.js` — **единственный источник правды** по составу панели: массив `SECTIONS` описывает 9 разделов и каждый инструмент (`id`, `title`, `icon`, `wired`, `roles`).
2. `getSectionsForRole(role)` фильтрует разделы и инструменты по роли (например, `salaries` видят только `founder`/`gen_dir`).
3. URL `/owner/:sectionId/:toolId` попадает в `ToolRouter`, который по таблице `RESOLVE[sectionId][toolId]` подбирает React-компонент.
4. Если `wired:false` или компонента нет — рендерится баннер «🚧 Дизайн-макет» или `ComingSoon`.

```mermaid
flowchart LR
    A["клик в сайдбаре"] --> B["URL /owner/finance/cashflow"]
    B --> C["ToolRouter читает useParams()"]
    C --> D["getSectionsForRole — проверка доступа роли"]
    D --> E["RESOLVE['finance']['cashflow'] → CashflowTool"]
    E --> F["компонент дёргает api.get('/api/finance/...')"]
```

> **Для PM:** добавить новый инструмент = (1) строка в `modules.js`, (2) компонент в `tools/`, (3) запись в `RESOLVE`. Backend-эндпоинт — отдельно. Поэтому «заглушка» = пункт в меню есть, а строки в `RESOLVE`/реальных данных ещё нет.

---

## 4. Backend — слои обработки запроса

Монолит, но с чёткой **цепочкой middleware**. Любой запрос к `/api/*` проходит одни и те же ворота, прежде чем дойти до бизнес-логики.

```mermaid
flowchart TD
    req["HTTP-запрос /api/*"] --> cors["CORS"]
    cors --> rl["express-rate-limit<br/>(authLimiter на /auth/*)"]
    rl --> jwtmw["<b>auth(roles)</b><br/>jwt.verify → req.user<br/>проверка роли в whitelist"]
    jwtmw -- "401 / 403" --> rej["отказ"]
    jwtmw --> scope["<b>getUserBranchIds(user, query)</b><br/>company_id → список branch_id<br/>manager → только свой филиал"]
    scope --> aigate{"AI-маршрут?"}
    aigate -- "да" --> gate["<b>aiGate</b><br/>users.ai_enabled ≠ false"]
    aigate -- "нет" --> handler
    gate --> handler["Бизнес-обработчик<br/>SQL через pg Pool"]
    handler --> redact["<b>Redaction</b><br/>manager не видит суммы прибыли<br/>(вырезается на сервере)"]
    redact --> audit["audit_log<br/>(кто / что / подозрительность)"]
    audit --> resp["JSON-ответ"]
```

**Сквозные механизмы безопасности (system engineer):**

| Механизм | Где | Что делает |
|---|---|---|
| **JWT-аутентификация** | `auth(roles)` middleware | `jwt.verify`, кладёт `req.user`, отбивает по роли |
| **Мультитенантность** | `getUserBranchIds()` | Всё скоупится по `company_id`; чужие компании недостижимы |
| **Филиальная изоляция** | тот же helper | `manager` видит только `branch_id`, к которому привязан |
| **Redaction** | в обработчиках | Менеджеру не отдаются суммы прибыли/выручки компании |
| **AI-гейт** | `aiGate` | Владелец может отключить AI конкретному пользователю |
| **Аудит** | `audit_log` + helper | Логирует действия, помечает подозрительные |
| **Rate limiting** | `express-rate-limit` | Защита `/auth/*` от перебора |
| **Хэш паролей** | `bcryptjs` | Пароли только в виде хэша |

**API-поверхность по разделам** (≈281 маршрут, топ-префиксы):

| Раздел панели | API-префиксы | ~маршрутов |
|---|---|---|
| 📊 Аналитика | `/api/analytics` · `/api/bhi` · `/api/bsc` | ~24 |
| 💰 Финансы | `/api/finance` · `/api/cash` · `/api/pricing` | ~29 |
| 🛒 Закупки | `/api/procurement` · `/api/suppliers` | ~22 |
| 🏭 Склад | `/api/warehouse` · `/api/stock` · `/api/products` · `/api/types` · `/api/categories` · `/api/inventory` | ~50 |
| 💼 Продажи / Операции | `/api/sales` · `/api/operations` · `/api/tasks` · `/api/task-templates` · `/api/checklists` · `/api/discounts` · `/api/police` | ~25 |
| 👥 Персонал (HR) | `/api/hr` · `/api/shifts` · `/api/team` · `/api/users` | ~37 |
| 📣 Маркетинг | `/api/marketing` | ~23 |
| 🎧 Клиентский сервис | `/api/crm` · `/api/customers` · `/api/nps` · `/api/debts` | ~30 |
| ⚙️ Настройки | `/api/integrations` · `/api/companies` · `/api/company` · `/api/admin` · `/api/audit-log` · `/api/role-change-log` · `/api/settings` | ~20 |
| 🤖 AI (сквозной) | `/api/ai` (chat · analyze · chart-data · suggest) | 5 |
| 🔐 Платформа | `/api/auth` · `/api/branches` · `/api/me` · `/api/health` · `/api/upload` | ~20 |

---

## 5. Entity-Relationship — модель данных

PostgreSQL, ~80 таблиц. Чтобы диаграмма читалась, разделяем её на **транзакционный «хребет»** (то, вокруг чего крутится всё) и **модульные кластеры** (таблицы конкретных инструментов).

### 5.1 Ядро (транзакционный хребет)

```mermaid
erDiagram
    COMPANIES ||--o{ BRANCHES : "владеет"
    COMPANIES ||--o{ USERS : "нанимает"
    COMPANIES ||--o{ PRODUCTS : "каталог"
    COMPANIES ||--o{ CUSTOMERS : "клиентская база"
    COMPANIES ||--o{ SUPPLIERS : "поставщики"

    BRANCHES ||--o{ USERS : "место работы"
    BRANCHES ||--o{ PRODUCT_STOCK : "остатки по филиалу"
    BRANCHES ||--o{ STOCK_INCOME : "приход"
    BRANCHES ||--o{ STOCK_OUTCOME : "расход/продажа"
    BRANCHES ||--o{ CASH_INCOME : "касса +"
    BRANCHES ||--o{ CASH_EXPENSE : "касса −"

    PRODUCTS ||--o{ PRODUCT_STOCK : "лежит на складах"
    PRODUCTS ||--o{ STOCK_INCOME : "поступал"
    PRODUCTS ||--o{ STOCK_OUTCOME : "продавался"
    PRODUCT_TYPES ||--o{ PRODUCTS : "тип"
    CATEGORIES ||--o{ PRODUCTS : "категория"

    CUSTOMERS ||--o{ STOCK_OUTCOME : "покупатель в чеке"
    SUPPLIERS ||--o{ STOCK_INCOME : "источник прихода"

    COMPANIES {
        int id PK
        string name
    }
    BRANCHES {
        int id PK
        int company_id FK
        string name
    }
    USERS {
        int id PK
        int company_id FK
        int branch_id FK
        string role
        bool ai_enabled
    }
    PRODUCTS {
        int id PK
        int company_id FK
        numeric price_buy
        numeric price_sell
    }
    PRODUCT_STOCK {
        int product_id FK
        int branch_id FK
        numeric quantity
    }
    STOCK_OUTCOME {
        int id PK
        int branch_id FK
        int product_id FK
        int customer_id FK
        numeric quantity
        numeric price
        string status
    }
    STOCK_INCOME {
        int id PK
        int branch_id FK
        int product_id FK
        int supplier_id FK
    }
    CASH_INCOME {
        int id PK
        int branch_id FK
        numeric amount
    }
    CASH_EXPENSE {
        int id PK
        int branch_id FK
        numeric amount
    }
```

> **Ключевой факт для инженера:** `stock_outcome` (продажи/расход) — самая горячая таблица: 162 обращения в коде. Вся выручка/прибыль/маржа считается как `SUM(quantity*price)` с `JOIN products` ради себестоимости (`price_buy`). Фильтр `status='approved'` отсекает черновики. `company_id` на `products` — второй замок: данные другой компании не подтянутся даже через филиал.

### 5.2 Модульные кластеры (какие таблицы за каким разделом)

Каждый раздел панели опирается на ядро **плюс** свои таблицы. Ниже — карта «раздел → его таблицы».

```mermaid
flowchart TB
    core["⭐ ЯДРО<br/>companies · branches · users<br/>products · product_stock<br/>stock_income · stock_outcome<br/>cash_income · cash_expense<br/>customers · suppliers"]

    core --- an["📊 Аналитика<br/>bhi_daily · anomalies · alerts<br/>basket_pairs · cohort_cache<br/>branch_daily_summary · funnel_inputs<br/>bsc_strategies · bsc_metrics · bsc_fact_values"]
    core --- fin["💰 Финансы<br/>exchange_rates · loans · fixed_assets<br/>tax_settings · tax_obligations · tax_payments<br/>balance_entries · payroll_liab"]
    core --- proc["🛒 Закупки<br/>purchase_orders · purchase_order_items<br/>receivings · receiving_items<br/>supplier_returns · (рейтинги)"]
    core --- wh["🏭 Склад<br/>stock_transfers · inventory_audits<br/>audit_items · product_types · categories"]
    core --- ops["💼 Продажи/Операции<br/>tasks · task_comments · task_templates<br/>checklist_templates · checklist_template_items<br/>checklist_completions · checklist_item_results<br/>discounts · sales_scripts · script_usage<br/>police_rules · police_alerts"]
    core --- hr["👥 Персонал<br/>salaries · schedules · shift_templates<br/>attendance · absences<br/>employee_adjustments · penalty_rules<br/>bonus_transactions · courses · lessons · course_progress"]
    core --- mkt["📣 Маркетинг<br/>leads · channel_spend · competitors<br/>marketing_personas · marketing_content<br/>loyalty_accounts · loyalty_transactions<br/>referrals · referral_codes · referral_settings<br/>notification_campaigns"]
    core --- sup["🎧 Клиентский сервис<br/>customer_rfm · customer_rfm_history<br/>complaints · complaint_history · reviews<br/>customer_bonuses · event_greetings"]
    core --- set["⚙️ Настройки<br/>company_features · company_integrations<br/>audit_log · ai_chat_log"]
```

| Раздел | Опорные таблицы (сверх ядра) |
|---|---|
| 📊 **Аналитика** | `bhi_daily`, `anomalies`, `alerts`, `basket_pairs`, `cohort_cache`, `branch_daily_summary`, `funnel_inputs`, `bsc_strategies/metrics/fact_values/departments` |
| 💰 **Финансы** | `exchange_rates`, `loans`, `fixed_assets`, `tax_settings/obligations/payments`, `balance_entries`, `payroll_liab` |
| 🛒 **Закупки** | `purchase_orders` + `purchase_order_items`, `receivings` + `receiving_items`, `supplier_returns` |
| 🏭 **Склад** | `stock_transfers`, `inventory_audits` + `audit_items`, `product_types`, `categories` |
| 💼 **Продажи / Операции** | `tasks` + `task_comments` + `task_templates`, `checklist_templates/template_items/completions/item_results`, `discounts`, `sales_scripts` + `script_usage`, `police_rules` + `police_alerts` |
| 👥 **Персонал (HR)** | `salaries`, `schedules`, `shift_templates`, `attendance`, `absences`, `employee_adjustments`, `penalty_rules`, `bonus_transactions`, `courses` + `lessons` + `course_progress` |
| 📣 **Маркетинг** | `leads`, `channel_spend`, `competitors`, `marketing_personas`, `marketing_content`, `loyalty_accounts` + `loyalty_transactions`, `referrals` + `referral_codes` + `referral_settings`, `notification_campaigns` |
| 🎧 **Клиентский сервис** | `customer_rfm` + `customer_rfm_history`, `complaints` + `complaint_history`, `reviews`, `customer_bonuses`, `event_greetings` |
| ⚙️ **Настройки** | `company_features`, `company_integrations`, `audit_log`, `ai_chat_log` |

---

## 6. AI-слой — «граница данных»

AI встроен как **аналитик поверх данных компании**, а не как чат с интернетом. Ключевые гарантии:

```mermaid
sequenceDiagram
    participant U as 👤 Владелец
    participant F as Frontend (AiChatDrawer)
    participant B as Backend (/api/ai/*)
    participant DB as PostgreSQL
    participant L as LLM-провайдер

    U->>F: вопрос «как у меня с прибылью?»
    F->>B: POST /api/ai/chat (JWT)
    B->>B: auth(AI_ROLES) + aiGate(ai_enabled)
    B->>DB: getCompanyContextForAI(user)<br/>(скоуп по company_id / branch_id)
    DB-->>B: снимок реальных цифр компании
    B->>B: system = AI_DATA_BOUNDARY + factSheet
    B->>L: fetch (ключ из ENV, не из браузера)
    L-->>B: текстовый разбор
    B->>DB: ai_chat_log (токены, латентность)
    B-->>F: ответ + (опц.) данные графика
    F-->>U: разбор по СВОИМ цифрам
```

**Что важно (system engineer):**
- **Ключ AI только в ENV сервера** (`AI_API_KEY`) — в браузер не уходит, backend выступает прокси. Провайдер переключается через `AI_API_URL` / `AI_MODEL` (DeepSeek по умолчанию, можно Groq LLaMA).
- **`getCompanyContextForAI(user)`** строит снимок: lifetime-выручка/прибыль/сделки, текущие 30 дней vs предыдущие, помесячный тренд за 24 мес, топ-товары/продавцы, остатки, долги — **всё отфильтровано по `company_id`**, а для `manager` — по его `branch_id`.
- **`AI_DATA_BOUNDARY`** — системная инструкция: отвечать **только** по приведённым цифрам, не выдумывать.
- **`/api/ai/analyze`** не доверяет числам от клиента: пересчитывает их **на сервере** теми же функциями, что и обычные эндпоинты (`computeCashflow`, `computeBreakEven`, `computeFinModel`, `computeChannels`), и только потом просит LLM дать разбор + 2-3 действия.
- **`ai_chat_log`** фиксирует расход токенов и латентность для контроля стоимости.

---

## 7. Сквозной поток: «клик → данные на экране»

Полный путь одного инструмента (на примере «Финансы → Cash Flow») — связывает все три слоя.

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 founder
    participant SPA as Frontend (CashflowTool)
    participant AX as api.js (axios)
    participant NG as Nginx
    participant EX as Express
    participant MW as auth + scope (middleware)
    participant PG as PostgreSQL

    U->>SPA: открывает /owner/finance/cashflow
    SPA->>SPA: ToolRouter → RESOLVE['finance']['cashflow']
    SPA->>AX: api.get('/api/finance/cashflow')
    AX->>AX: интерсептор: + Authorization Bearer JWT
    AX->>NG: GET /api/finance/cashflow
    NG->>EX: проксирует на Node
    EX->>MW: auth(['founder','gen_dir','manager'])
    MW->>MW: jwt.verify → req.user; getUserBranchIds()
    MW->>PG: SQL по branch_id ∈ company_id
    PG-->>EX: строки cash_income / cash_expense
    EX->>EX: агрегация + redaction по роли
    EX-->>SPA: JSON {income, expense, balance, forecast}
    SPA-->>U: график и цифры Cash Flow
```

---

## 8. Деплой (prod-топология)

```mermaid
flowchart LR
    dev["💻 Разработчик<br/>git develop → main"] -->|"scp статика + git pull"| host

    subgraph host["🌍 mywarehouse.uz"]
        nginx["Nginx<br/>статика фронта (chmod a+rX!)<br/>/api → Node"]
        pm2["pm2: <b>wareapp-api</b><br/>node server.js"]
        pgsql[("PostgreSQL<br/>ensureSchema() при старте")]
        nginx --> pm2 --> pgsql
    end

    pm2 -.->|ENV| envs["AI_API_KEY · AI_API_URL · AI_MODEL<br/>JWT_SECRET · DATABASE_URL · TELEGRAM_*"]
```

**Подводные камни эксплуатации (из практики проекта):**
- После `scp` фронта **обязательно** `chmod -R a+rX` на каталоге — иначе Nginx отдаёт `403`.
- `ensureSchema()` идёт одним `try/catch`: таблицы, принадлежащие пользователю `postgres` (например `audit_log`, `bhi_daily`), могут уронить миграцию прав — следить за владельцем таблиц.
- Демо-данные: `backend/seed_demo.js` (обратимый, помечает `[SEED]`) оживляет дашборд; `backend/harness.js` — 64 проверки всех окон. Компания `id=1` = демо.

---

## 9. Карта репозитория (навигация)

| Путь | Что внутри |
|---|---|
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Роутинг по ролям, проверка JWT, ленивые оболочки |
| [frontend/src/api.js](../frontend/src/api.js) | axios-клиент: JWT-интерсептор, авто-`branch_id` для продавца, 401→logout |
| [frontend/src/owner/OwnerShell.jsx](../frontend/src/owner/OwnerShell.jsx) | Оболочка владельца: сайдбар, разделы, AI-drawer, дашборд |
| [frontend/src/owner/modules.js](../frontend/src/owner/modules.js) | **Источник правды** по 9 разделам и 115 инструментам |
| [frontend/src/owner/ToolRouter.jsx](../frontend/src/owner/ToolRouter.jsx) | `RESOLVE`: маппинг `section/tool → React-компонент` |
| [frontend/src/owner/tools/](../frontend/src/owner/tools/) | Компоненты инструментов (100 готовых + макеты) |
| [frontend/src/components/](../frontend/src/components/) | Live-компоненты на реальных данных (склад, касса, KPI, CRM) |
| [backend/server.js](../backend/server.js) | Монолит: middleware, ~281 маршрут, `ensureSchema()`, AI-прокси |
| [backend/migrations/001_init.sql](../backend/migrations/001_init.sql) | Базовые таблицы ядра |
| [backend/seed_demo.js](../backend/seed_demo.js) · [backend/harness.js](../backend/harness.js) | Демо-сидер и проверочный харнесс |

---

### Легенда статусов инструментов
🟢 **Готов** (`wired:true`) — реальные данные из API · 🟡 **Заглушка** (`wired:false`) — пункт меню есть, данные/`RESOLVE` ещё нет (15 шт.).

*Документ отражает состояние ветки `develop` и опирается на код, а не на предположения. При изменении `modules.js`, `RESOLVE` или схемы БД — обновляйте соответствующие разделы.*
