# shellcheck shell=bash
# Подключение /api/decor/ в nginx. Подключается из install.sh: nginx_decor <порт>.
# Для теста (test/nginx-decor.test.js): NGINX_DIR, NGINX_BACKUPS и подставные nginx/systemctl в PATH.
#
# Ошибки — явными return: функция вызывается как `nginx_decor … || die`, а в такой
# позиции bash отключает set -e внутри неё.
nginx_decor() {
  local port="$1"
  local dir="${NGINX_DIR:-/etc/nginx}"
  local backups="${NGINX_BACKUPS:-/root/rollback/nginx}"
  local stale conf backup

  # Копии конфига — только ВНЕ папок, которые nginx подключает целиком (sites-enabled/*, conf.d/*.conf):
  # копия рядом с оригиналом читается как второй сайт → «duplicate default server», nginx -t падает.
  # (Так и случилось при первой установке 2026-10-26 — оставшуюся копию убираем.)
  mkdir -p "$backups" || return 1
  for stale in "$dir"/sites-enabled/*.before-decor-* "$dir"/conf.d/*.before-decor-*; do
    [ -e "$stale" ] || continue
    mv "$stale" "$backups/" || return 1
    echo "убрана копия из папки nginx: $stale → $backups/"
  done

  if ! nginx -t 2>/dev/null; then
    echo "nginx -t не проходит ещё до правок — конфиг сервера уже сломан, ничего не трогаю (смотрите: nginx -t)" >&2
    return 1
  fi

  conf="$(grep -lE '^[[:space:]]*location[[:space:]]+/api/[[:space:]]*\{' "$dir"/sites-enabled/* "$dir"/conf.d/*.conf 2>/dev/null | head -1 || true)"
  if [ -z "$conf" ]; then
    echo "не найден конфиг nginx с 'location /api/ {' — добавьте блок вручную (document/ДЕКОР-ВЫКЛАДКА.md)" >&2
    return 1
  fi
  conf="$(readlink -f "$conf")"
  if grep -q 'location /api/decor/' "$conf"; then
    echo "блок уже есть в $conf"
    return 0
  fi

  backup="$backups/$(basename "$conf").before-decor-$(date +%F-%H%M%S)"
  cp "$conf" "$backup" || return 1
  # Блок — перед каждым 'location /api/ {' (если server-блоков несколько — в каждый).
  # [ \t] вместо [[:space:]]: в Ubuntu awk — это mawk, старые версии классов символов не знают.
  if ! awk -v port="$port" '
    /^[ \t]*location[ \t]+\/api\/[ \t]*\{/ {
      match($0, /^[ \t]*/); ind = substr($0, 1, RLENGTH)
      print ind "# Сервис «Декор» (decor-api): фото и видео с телефона до 300 МБ за раз"
      print ind "location /api/decor/ {"
      print ind "    proxy_pass http://127.0.0.1:" port "/api/decor/;"
      print ind "    proxy_http_version 1.1;"
      print ind "    proxy_set_header Host $host;"
      print ind "    proxy_set_header X-Real-IP $remote_addr;"
      print ind "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print ind "    proxy_set_header X-Forwarded-Proto $scheme;"
      print ind "    client_max_body_size 300m;"
      print ind "    proxy_read_timeout 300s;"
      print ind "    proxy_send_timeout 300s;"
      print ind "}"
    }
    { print }' "$backup" > "$conf"; then
    cp "$backup" "$conf"
    echo "не удалось записать $conf — конфиг возвращён как был" >&2
    return 1
  fi

  if nginx -t; then
    systemctl reload nginx || return 1
    echo "блок добавлен в $conf, nginx перезагружен (копия прежнего: $backup)"
  else
    cp "$backup" "$conf"
    echo "nginx -t не прошёл — конфиг возвращён как был (копия: $backup)" >&2
    return 1
  fi
}
