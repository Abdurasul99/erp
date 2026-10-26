#!/usr/bin/env bash
# Применяет миграции сферы «Декор» по порядку и пропускает уже применённые (таблица schema_migrations).
# Запускать от пользователя базы сферы, чтобы он был владельцем таблиц:
#   PGHOST=127.0.0.1 PGUSER=wave_decor_user PGPASSWORD=... bash apply_decor_migrations.sh wave_decor
# Если psql не в PATH (Windows):  PSQL="/c/Program Files/PostgreSQL/16/bin/psql.exe" bash apply_decor_migrations.sh wave_decor
set -euo pipefail
DB="${1:?укажите базу, например wave_decor}"
PSQL="${PSQL:-psql}"
cd "$(dirname "$0")"
FILES=(D00_core_contract.sql D10_decor_domain.sql D20_late_return.sql D21_returned_after_close.sql D22_company_delete.sql D23_idempotency.sql D24_evidence_fund.sql)
for f in "${FILES[@]}"; do
  v="${f%.sql}"
  if "$PSQL" -d "$DB" -tAc "SELECT 1 FROM schema_migrations WHERE version='$v'" 2>/dev/null | grep -q 1; then
    echo "пропуск  $f (уже применена)"; continue
  fi
  echo "применяю $f"
  "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -1 -f "$f" > /dev/null
done
echo "готово"
