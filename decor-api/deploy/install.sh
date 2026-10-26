#!/usr/bin/env bash
# Установка и обновление сервиса «Декор» (decor-api) на сервере. Запуск от root:
#   bash /var/www/wareapp/decor-api/deploy/install.sh
# Повторный запуск безопасен: ничего не создаёт второй раз, пароли не меняет,
# применяет только новые миграции, nginx правит только если блока ещё нет.
# Wave (wareapp-api, база warehouse) этот скрипт не трогает.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"
PORT=3003
DB=wave_decor
DB_USER=wave_decor_user
DEFAULT_UPLOADS=/var/lib/wave-decor/uploads
BACKUP_DIR=/var/backups/wareapp

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nОШИБКА: %s\n' "$*" >&2; exit 1; }
envval() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
# psql от postgres; SQL — через stdin, чтобы пароль не светился в списке процессов
pgq() { (cd /tmp && sudo -u postgres psql -v ON_ERROR_STOP=1 -tAq); }

[ "$(id -u)" = 0 ] || die "запускать от root"
for c in node npm pm2 openssl psql curl nginx; do command -v "$c" >/dev/null || die "не найдена команда $c"; done

say "1/8 Настройки (.env)"
NEW_ENV=0
if [ ! -f "$ENV_FILE" ]; then
  (umask 077 && cat > "$ENV_FILE" <<EOF
NODE_ENV=production
TZ=Asia/Tashkent
DECOR_HOST=127.0.0.1
DECOR_PORT=$PORT
DECOR_DB_HOST=127.0.0.1
DECOR_DB_PORT=5432
DECOR_DB_NAME=$DB
DECOR_DB_USER=$DB_USER
DECOR_DB_PASS=$(openssl rand -hex 24)
DECOR_JWT_SECRET=$(openssl rand -hex 32)
DECOR_UPLOADS_DIR=$DEFAULT_UPLOADS
EOF
  )
  NEW_ENV=1
  echo "создан $ENV_FILE: пароль базы и секрет входа — случайные, нигде больше не хранятся"
else
  echo "уже есть $ENV_FILE — не трогаю"
fi
chmod 600 "$ENV_FILE"
DB_PASS="$(envval DECOR_DB_PASS)"
UPLOADS_DIR="$(envval DECOR_UPLOADS_DIR)"; UPLOADS_DIR="${UPLOADS_DIR:-$DEFAULT_UPLOADS}"
[ -n "$DB_PASS" ] || die "в $ENV_FILE нет DECOR_DB_PASS"
[[ "$DB_PASS" =~ ^[A-Za-z0-9]+$ ]] || die "DECOR_DB_PASS — только латиница и цифры (так его можно безопасно передать в SQL)"

say "2/8 База $DB и её владелец $DB_USER"
if [ "$(echo "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | pgq)" != "1" ]; then
  echo "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'" | pgq
  echo "создана роль $DB_USER"
elif [ "$NEW_ENV" = 1 ]; then
  echo "ALTER ROLE $DB_USER PASSWORD '$DB_PASS'" | pgq
  echo "роль уже была — пароль приведён к новому .env"
else
  echo "роль есть"
fi
if [ "$(echo "SELECT 1 FROM pg_database WHERE datname='$DB'" | pgq)" != "1" ]; then
  echo "CREATE DATABASE $DB OWNER $DB_USER" | pgq
  echo "создана база $DB"
else
  echo "база есть"
fi

say "3/8 Папка фото и видео: $UPLOADS_DIR"
case "$UPLOADS_DIR" in
  */backend/uploads*|*/frontend/dist*) die "папка фото внутри публичной — фото увидят без входа";;
esac
mkdir -p "$UPLOADS_DIR"
chmod 700 "$UPLOADS_DIR"
[ "$UPLOADS_DIR" = "$DEFAULT_UPLOADS" ] && chmod 700 "$(dirname "$DEFAULT_UPLOADS")"

say "4/8 Зависимости (npm ci)"
(cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)

say "5/8 Миграции D00–D24 (применяются только новые)"
PGHOST=127.0.0.1 PGUSER="$DB_USER" PGPASSWORD="$DB_PASS" bash "$APP_DIR/sql/apply_decor_migrations.sh" "$DB"

say "6/8 Запуск decor-api в pm2 (127.0.0.1:$PORT)"
if pm2 describe decor-api >/dev/null 2>&1; then
  pm2 restart decor-api --update-env
else
  if ss -ltn | grep -qE "[:.]$PORT[[:space:]]"; then die "порт $PORT занят другим процессом"; fi
  pm2 start "$APP_DIR/server.js" --name decor-api --cwd "$APP_DIR"
fi
pm2 save >/dev/null
HEALTH=""
for _ in $(seq 1 20); do
  HEALTH="$(curl -sS "http://127.0.0.1:$PORT/api/decor/health" 2>/dev/null || true)"
  case "$HEALTH" in *'"status":"ok"'*) break;; esac
  sleep 1
done
echo "$HEALTH"
case "$HEALTH" in *'"status":"ok"'*) ;; *) die "decor-api не ответил ok. Лог: pm2 logs decor-api --lines 50 --nostream";; esac

say "7/8 nginx: /api/decor/ → 127.0.0.1:$PORT"
. "$APP_DIR/deploy/nginx-decor.sh"
nginx_decor "$PORT" || die "nginx: см. сообщение выше"

say "8/8 Ежедневный бэкап: база $DB и папка фото"
mkdir -p "$BACKUP_DIR"
cat > /usr/local/bin/wave-decor-backup.sh <<EOF
#!/usr/bin/env bash
# Бэкап «Декора» (ставит decor-api/deploy/install.sh). База — снимок за день, хранится 14 дней.
# Фото и видео не меняются после загрузки (имя уникально), поэтому копируются только новые —
# одна растущая копия, а не полный архив каждый день.
set -euo pipefail
D=\$(date +%F)
cd /tmp
sudo -u postgres pg_dump $DB | gzip > "$BACKUP_DIR/wave_decor-\$D.sql.gz"
find "$BACKUP_DIR" -maxdepth 1 -name 'wave_decor-*.sql.gz' -mtime +14 -delete
mkdir -p "$BACKUP_DIR/decor-uploads"
cp -a -n "$UPLOADS_DIR/." "$BACKUP_DIR/decor-uploads/"
EOF
chmod 700 /usr/local/bin/wave-decor-backup.sh
echo '30 3 * * * root /usr/local/bin/wave-decor-backup.sh' > /etc/cron.d/wave-decor-backup
chmod 644 /etc/cron.d/wave-decor-backup
/usr/local/bin/wave-decor-backup.sh
ls -la "$BACKUP_DIR" | grep -E 'wave_decor-|decor-uploads' | tail -2 || true

say "ГОТОВО"
echo "Проверка снаружи:  curl -s https://mywarehouse.uz/api/decor/health"
echo "Первая компания:   cd $APP_DIR && node scripts/create-company.js --company \"Название\" --username логин --name \"Имя Фамилия\""
