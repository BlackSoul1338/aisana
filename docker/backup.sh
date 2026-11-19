#!/bin/sh
# ── Ежедневный бэкап PostgreSQL с ротацией ──────────────────
# Запускается в контейнере backup (см. docker-compose.yml).
# Формат custom (-F c): компактный, восстанавливается через pg_restore
# целиком или выборочно по таблицам.
#
# Разовый бэкап вручную:
#   docker compose exec backup /backup.sh once
set -eu

# Дампы могут содержать персональные данные — доступ только владельцу
umask 077

BACKUP_DIR=/backups
RETENTION_DAYS=14
INTERVAL_SECONDS=86400   # раз в сутки

do_backup() {
  ts=$(date +%Y-%m-%d_%H%M%S)
  file="$BACKUP_DIR/ai_map_kz_$ts.dump"
  echo "[$(date '+%F %T')] pg_dump -> $file"
  pg_dump -h db -U postgres -d ai_map_kz -F c -f "$file"
  chmod 600 "$file"
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

# Просроченные сессии: вход по ним уже невозможен, но строки копятся.
# Таблицу читают на каждый запрос, поэтому чистим её вместе с кэшем.
#
# Журнал аудита: срок хранения - политика заказчика, поэтому по умолчанию
# записи не удаляются. Чистка включается AUDIT_RETENTION_DAYS (дни) и идёт
# только после успешного дампа: без копии удалённое не восстановить.
purge_audit_logs() {
  [ -n "${AUDIT_RETENTION_DAYS:-}" ] || return 0
  if ! [ "$AUDIT_RETENTION_DAYS" -ge 1 ] 2>/dev/null; then
    echo "[$(date '+%F %T')] аудит: AUDIT_RETENTION_DAYS должно быть целым числом дней — чистка пропущена"
    return 1
  fi
  count=$(psql -h db -U postgres -d ai_map_kz -tAc \
    "WITH deleted AS (DELETE FROM audit_logs WHERE \"createdAt\" <= now() - make_interval(days => $AUDIT_RETENTION_DAYS) RETURNING 1) SELECT count(*) FROM deleted") \
    || return 1
  echo "[$(date '+%F %T')] аудит: удалено старше $AUDIT_RETENTION_DAYS дн. — $count"
}

purge_sessions() {
  count=$(psql -h db -U postgres -d ai_map_kz -tAc \
    "WITH deleted AS (DELETE FROM sessions WHERE expires <= now() RETURNING 1) SELECT count(*) FROM deleted") \
    || return 1
  echo "[$(date '+%F %T')] сессии: удалено просроченных — $count"
}

if [ "${1:-}" = "once" ]; then
  do_backup
  exit 0
fi

# Первый бэкап сразу при старте, дальше по интервалу.
# Ошибка одного прогона не убивает цикл — следующая попытка через сутки.
while true; do
  if do_backup; then
    purge_audit_logs || echo "[$(date '+%F %T')] ОШИБКА ЧИСТКИ АУДИТА — не критично"
  else
    echo "[$(date '+%F %T')] ОШИБКА БЭКАПА — повтор через сутки"
  fi
  purge_llm_cache || echo "[$(date '+%F %T')] ОШИБКА ЧИСТКИ КЭША ИИ — не критично"
  purge_sessions || echo "[$(date '+%F %T')] ОШИБКА ЧИСТКИ СЕССИЙ — не критично"
  sleep "$INTERVAL_SECONDS"
done
