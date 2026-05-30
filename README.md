# WareApp — ERP for retail / wholesale (Uzbekistan)

Multi-company, multi-branch warehouse and cash management system.
Live at https://mywarehouse.uz

## Stack

- **Backend:** Node.js · Express · PostgreSQL · JWT auth · multer (uploads) · ExcelJS
- **Frontend:** React + Vite · React Router · jsbarcode · html5-qrcode (camera scanner)
- **Infra:** Ubuntu VPS · nginx + HTTPS · pm2 (process manager) · daily pg_dump

## Features

- **Multi-company / multi-branch** with per-branch stock and cash
- **Roles:** admin · founder · gen_dir · manager · cashier · warehouse · seller
- **Warehouse:** receipts (Приход), B2B sales, supplier returns, writeoffs, balance
- **Cash:** income / expense in 10 currencies (UZS · USD · EUR · RUB · KZT · CNY · TRY · KRW · GBP · AED), period-aware Report tab
- **Sales pipeline:** seller creates → warehouse approves → cashier settles (settlement workflow)
- **Multi-currency sales:** customer pays in foreign cur at street rate, system stores both UZS-equivalent and original
- **Customers & Suppliers** with debt tracking (paid / partial / debt)
- **Barcode printing:** 58×40mm thermal label template
- **Mobile POS** at `/mobile` for cashier and seller workflows
- **Audit log** for role changes and sensitive ops

## Local development

```bash
# Backend
cd backend
npm install
cp ../.env.example .env   # then fill in values
npm start                 # listens on :3000

# Frontend
cd frontend
npm install
npm run dev               # vite dev server
```

## Deploy

Backend runs under pm2 on the VPS (`pm2 restart wareapp-api`).
Frontend is built locally / on server (`npm run build`) → nginx serves `frontend/dist/`.

## Migrations

`backend/migrations/` contains `*.sql` files run via `psql warehouse < file.sql`.
