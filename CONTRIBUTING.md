# Гайд для разработчиков WareApp

Этот файл — обязательное чтение для всех, кто получает доступ к репозиторию.
Все правила ниже **строгие**, нарушение = revoke access.

---

## 🚦 Правила работы с git

### 1. ⛔ НИКОГДА не пушь напрямую в `main`

Только через Pull Request с одобрением владельца (@Abdurasul99).
Прямой push в `main` заблокирован на уровне GitHub branch protection.

### 2. ✅ Работай только в своей ветке

| Кто | Ветка |
|---|---|
| Владелец (@Abdurasul99) | `main` · `develop` · любая |
| Коллабораторы | `develop` или `feature/<short-task>` ответвлённые от `develop` |

### 3. Workflow на день

```bash
# 1. Подтянуть актуальный develop
git fetch origin
git switch develop
git pull origin develop

# 2. Создать feature-ветку под свою задачу
git switch -c feature/название-задачи

# 3. Коммитить часто, осмысленно
git add <files>      # НИКОГДА git add -A — может прилететь .env / CREDENTIALS.md
git commit -m "feat(модуль): что сделал"

# 4. Pushить в свою ветку
git push -u origin feature/название-задачи

# 5. Открыть Pull Request → base: develop, compare: feature/название-задачи
# Через GitHub UI или: gh pr create --base develop
```

### 4. Pull Request review

- PR требует **минимум 1 approval от владельца** перед merge
- CI должна быть зелёной (когда подключим CI)
- После merge `develop` → `main` идёт ОТДЕЛЬНЫМ PR от владельца
- **Force push в develop и main запрещён** (защита на GitHub)

### 5. Commit messages — conventional commits

```
feat(модуль): краткое описание новой фичи
fix(модуль): что починили
docs: обновление документации
refactor: рефакторинг без изменения поведения
chore: тех. задачи (deps, config)
```

Тело коммита — что изменилось и **почему**. Не нужно описывать «что» — это видно в diff.

---

## 🔐 Безопасность секретов

### Что НИКОГДА не должно попасть в git

| Файл | Содержит | Защита |
|---|---|---|
| `backend/.env` | DEEPSEEK_API_KEY · JWT_SECRET · DB_PASS | в `.gitignore` |
| `CREDENTIALS.md` | Owner-level прод-ключи | в `.gitignore` |
| `COLLABORATOR_KEYS.md` | Dev-ключи + GitHub PAT | в `.gitignore` |
| `_deploy*.cjs` · `_deploy_tmp/` | SSH-пароли + deploy-скрипты | в `.gitignore` |
| `*.pem` · `*.key` · `*credentials*.md` · `*secret*.md` | Любые приватные ключи | в `.gitignore` |

### Что делать ДО commit:

```bash
git status              # посмотри ЧТО собираешься коммитить
git diff --cached       # посмотри сами изменения
# Если видишь .env / credentials / api_key — НЕ КОММИТЬ. Откатить:
git restore --staged <file>
```

### Если случайно запушил секрет

1. Сразу скажи владельцу (@Abdurasul99) — он ротирует ключ
2. Никогда не пытайся «откатить» git commit с секретом — он остаётся в истории
3. Ротация ключа = единственный способ обезопасить

### Никогда не используй

- `git add -A` или `git add .` (захватит лишнее) → добавляй явно `git add path/to/file`
- `git commit --no-verify` (пропускает pre-commit hooks)
- `git push --force` в основные ветки (delete + recreate коммитов)
- `git push --no-verify` (пропускает pre-push hooks)

---

## 🏗️ Локальный setup

### Стек

- **Backend:** Node 20+ · Express · PostgreSQL 14+ · JWT
- **Frontend:** React 18 + Vite + React Router
- **DB:** PostgreSQL 14+

См. [README.md](README.md) — там полная инструкция. Кратко:

```bash
git clone -b develop https://github.com/Abdurasul99/erp.git wareapp
cd wareapp

cd backend && npm install
cd ../frontend && npm install
cd ..

# DB локально (один раз)
psql -U postgres -c "CREATE USER wareapp_user WITH PASSWORD 'локальный_пароль';"
psql -U postgres -c "CREATE DATABASE warehouse OWNER wareapp_user;"

# env
cp .env.example backend/.env
# отредактировать backend/.env под свои локальные значения

# запуск
cd backend && npm start &
cd frontend && npm run dev
# → http://localhost:5173
```

---

## 🧪 Тесты

```bash
cd backend && npm test          # smoke-тесты ходят в реальную БД (локальную!)
cd frontend && npm run build    # проверить что фронт собирается
```

PR с проваленными тестами не merge-ится. Если тест-данные ломают тест — починить, не отключать.

---

## 📦 Структура проекта

```
.
├── backend/server.js          ← ~5200 строк, все API endpoints
├── backend/migrations/        ← *.sql
├── backend/test/smoke.test.js ← smoke-тесты
├── frontend/src/
│   ├── owner/                 ← owner-shell для founder/gen_dir/manager
│   ├── admin/                 ← admin-shell для SaaS-провайдера
│   ├── pages/                 ← legacy: Login, Desktop, Mobile, SellerView
│   ├── components/            ← legacy менеджеры
│   ├── utils/                 ← printLabel, helpers
│   └── i18n.js                ← ru/uz переводы
├── README.md                  ← общая инструкция
├── CONTRIBUTING.md            ← этот файл
└── .env.example               ← шаблон для backend/.env
```

---

## 🗂️ Куда что коммитить

- **Backend изменения** → отдельный коммит, скоупом `backend/`
- **Frontend изменения** → отдельный коммит, скоупом `frontend/`
- **БД миграции** → отдельный коммит + одноразовый файл в `backend/migrations/`
- **Документация** → отдельный коммит со скоупом `docs:`

Один логический change = один коммит. Не мешай рефакторинг с фичей.

---

## ❓ Стуки в случае вопросов

- Вопросы про код, архитектуру, deploy → @Abdurasul99
- Срочные баги в проде → создавай GitHub Issue с тегом `bug` + пиши владельцу

---

**Подписывая этот файл (читая и работая по нему) ты принимаешь правила.**
