# WareApp — ERP for retail / wholesale (Uzbekistan)

Multi-company, multi-branch warehouse + cash management SaaS.
Live at https://mywarehouse.uz

---

## Stack

- **Backend:** Node.js 20+ · Express · PostgreSQL 14+ · JWT auth · multer · ExcelJS · bcryptjs
- **Frontend:** React 18 + Vite · React Router 6 · axios · jsbarcode · html5-qrcode
- **AI:** DeepSeek API (chat + chart-tag rendering)
- **Infra (prod):** Ubuntu 22 · nginx + HTTPS · pm2 · daily pg_dump

---

## Features (high level)

- **Multi-company / multi-branch** with per-branch stock and cash
- **7 roles:** admin · founder · gen_dir · manager · cashier · warehouse · seller
- **Owner shell** (founder/gen_dir/manager) — `/owner/*` with 8 sections: Главная · Финансы · Маркетинг · Закупки · Склад · Продажи/Операции · HR · Клиентский сервис
- **Admin shell** (SaaS provider) — `/admin/*` with cross-tenant dashboard, feature flags, audit log
- **AI consultant** — DeepSeek-powered chat with full company context + inline charts (`[[CHART:type]]` tags)
- **Warehouse ops:** receipts (Приход), B2B sales, supplier returns, writeoffs, balance
- **Cash:** income / expense in 10 currencies, period-aware reports
- **Sales pipeline:** seller → warehouse approve → cashier settle
- **Marketing CRUD:** personas (JTBD), content plan
- **Customer segmentation:** VIP / Active / Sleeping / Lost / New (RFM-lite)
- **ABC / XYZ inventory analysis**
- **Pricing analyzer** (margin red/yellow/green)
- **Risk control center** (low stock + overdue debts + abnormal margins)
- **Multi-currency sales:** customer pays at street rate, stored both in UZS and original
- **Customers & Suppliers** with debt tracking (paid / partial / debt)
- **Mobile POS** at `/sell` for sellers, `/mobile` for full cashier flow
- **Barcode printing** with adaptive paper size (58×40, 58×30, 40×30, A4, custom W×H cm)
- **Audit log** + role change log
- **Multi-tenant isolation** — strict company_id scoping on all endpoints

---

## Run locally

### 1. Prerequisites

- **Node.js 20+** ([download](https://nodejs.org/))
- **PostgreSQL 14+** ([download](https://www.postgresql.org/download/))
- **Git**

### 2. Clone and install

```bash
git clone https://github.com/Abdurasul99/erp.git wareapp
cd wareapp

# Backend deps
cd backend
npm install
cd ..

# Frontend deps
cd frontend
npm install
cd ..
```

### 3. Create the database

Open `psql` as a superuser (`postgres` user) and run:

```sql
CREATE USER wareapp_user WITH PASSWORD '<DB_PASSWORD>';
CREATE DATABASE warehouse OWNER wareapp_user;
GRANT ALL PRIVILEGES ON DATABASE warehouse TO wareapp_user;
```

Then load the initial schema:

```bash
psql -U wareapp_user -d warehouse -f backend/migrations/001_init.sql
```

### 4. Configure env vars

```bash
cp .env.example backend/.env
# Open backend/.env and fill in real values:
#   DB_PASS          → your local PostgreSQL password
#   JWT_SECRET       → generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   DEEPSEEK_API_KEY → from https://platform.deepseek.com (optional — AI features off without it)
```

> ⚠️ Never commit `backend/.env`. It is already in `.gitignore`.

### 5. Start

```bash
# Terminal 1 — backend (port 3001)
cd backend
npm start

# Terminal 2 — frontend dev server (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173 in the browser. The frontend proxies API calls to `http://localhost:3001`.

### 6. Create a first admin user

The seed in `001_init.sql` may already include `admin / admin`. If not:

```sql
INSERT INTO users (username, password_hash, role)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjZAgcfl7p92ldGxad68LJZdL17lhW',  -- bcrypt of "admin"
  'admin'
);
```

Log in with `admin` / `admin` → create a company → create gen_dir → log out → log back in as gen_dir.

---

## Production deploy

The live server runs on a Ubuntu VPS:

- nginx serves `frontend/dist/` and proxies `/api → http://localhost:3001`
- pm2 runs `backend/server.js` as `wareapp-api`
- Backend env is in `/var/www/wareapp/backend/.env` (chmod 600)
- TLS via Let's Encrypt + certbot

Deploy = build frontend locally, SCP `frontend/dist/` + `backend/server.js` to server, then:

```bash
systemctl reload nginx
pm2 restart wareapp-api
```

For DB migrations / schema upgrades: edit `backend/migrations/*.sql` and apply with `psql`.

---

## Project structure

```
.
├── backend/
│   ├── server.js              ← ~4500 lines, all routes
│   ├── migrations/            ← *.sql for schema
│   ├── test/smoke.test.js     ← endpoint smoke tests
│   └── uploads/               ← user photos (not committed)
├── frontend/
│   ├── src/
│   │   ├── pages/             ← Login, Desktop, Mobile, SellerView
│   │   ├── components/        ← legacy managers (WarehouseBalance, CashIncome, …)
│   │   ├── owner/             ← new /owner shell (sidebar + 8 sections)
│   │   ├── admin/             ← new /admin shell (SaaS dashboard)
│   │   ├── utils/             ← printLabel, PaperSizeControl, helpers
│   │   ├── api.js             ← axios instance
│   │   └── i18n.js            ← ru / uz translations
│   └── dist/                  ← build output (not committed)
├── README.md                  ← this file
├── .env.example               ← template for backend/.env
└── .gitignore
```

---

## Roles overview

| Role | Where they land | Can do |
|---|---|---|
| `admin` | `/admin` | Full SaaS-level access; feature flags; audit log across companies |
| `founder` | `/owner` | All-branches view, AI consultant, full edit |
| `gen_dir` | `/owner` | Same as founder for that company |
| `manager` | `/owner` | Single-branch view, no AI access |
| `cashier` | `/desktop` (old) or `/mobile` (POS) | Cash + warehouse income/outcome |
| `warehouse` | `/desktop` | Receive / writeoff goods, approve outcomes |
| `seller` | `/sell` (mobile-first) | Create pending sales, settle to cashier |

---

## Testing

```bash
# Backend smoke tests (hit real DB)
cd backend
npm test
```

Tests log results to console; ~80 assertions across auth, products, sales, cash, settlement, KPI, dashboard.

---

## License

Private / proprietary. Source available to authorised collaborators only.
