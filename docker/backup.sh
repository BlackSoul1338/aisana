#!/bin/sh
# ── Ежедневный бэкап PostgreSQL с ротацией ──────────────────
# Запускается в контейнере backup (см. docker-compose.yml).
# Формат custom (-F c): компактный, восстанавливается через pg_restore
# целиком или выборочно по таблицам.
#
# Разовый бэкап вручную:
#   docker compose exec backup /backup.sh once
set -eu

BACKUP_DIR=/backups
RETENTION_DAYS=14
INTERVAL_SECONDS=86400   # раз в сутки

do_backup() {
  ts=$(date +%Y-%m-%d_%H%M%S)
  file="$BACKUP_DIR/ai_map_kz_$ts.dump"
  echo "[$(date '+%F %T')] pg_dump -> $file"
  pg_dump -h db -U postgres -d ai_map_kz -F c -f "$file"
  echo "[$(date '+%F %T')] готово: $(du -h "$file" | cut -f1)"

  # Ротация: удаляем дампы старше RETENTION_DAYS дней
  find "$BACKUP_DIR" -name 'ai_map_kz_*.dump' -mtime +"$RETENTION_DAYS" -delete
  echo "[$(date '+%F %T')] в хранилище: $(ls "$BACKUP_DIR" | wc -l) файлов"
}

# Чистка кэша ответов ИИ: просроченные записи больше не нужны.
# Таблица маленькая, но без чистки она растёт бесконечно.
#
# Число удалённых строк считает сам запрос: у «DELETE ... RETURNING» psql
# печатает ещё и строку «DELETE N», и подсчёт строк вывода врал на единицу.
purge_llm_cache() {
  count=$(psql -h db -U postgres -d ai_map_kz -tAc \
    "WITH deleted AS (DELETE FROM llm_cache WHERE \"expires_at\" <= now() RETURNING 1) SELECT count(*) FROM deleted") \
    || return 1
  echo "[$(date '+%F %T')] кэш ИИ: удалено просроченных записей — $count"
}

if [ "${1:-}" = "once" ]; then
  do_backup
  exit 0
fi

# Первый бэкап сразу при старте, дальше по интервалу.
# Ошибка одного прогона не убивает цикл — следующая попытка через сутки.
while true; do
  do_backup || echo "[$(date '+%F %T')] ОШИБКА БЭКАПА — повтор через сутки"
  purge_llm_cache || echo "[$(date '+%F %T')] ОШИБКА ЧИСТКИ КЭША ИИ — не критично"
  sleep "$INTERVAL_SECONDS"
done
