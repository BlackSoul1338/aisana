-- Дата последнего входа пользователя. Колонка необязательная.
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Заполняем по тому, что уже есть в базе. Меняется только новая колонка.
--   Сессии: сессия живёт 30 дней с момента входа, значит вход был за 30 дней
--   до её срока. Но при выходе сессия удаляется, поэтому берём ещё и
--   журнал действий: запись в нём означает, что пользователь тогда работал.
-- У кого нет ни сессий, ни записей в журнале, остаётся NULL. Это не строго
-- «не входил»: вошёл, ничего не сделал и вышел — следа не осталось.
UPDATE "users" u
SET "lastLoginAt" = t.last_seen
FROM (
  SELECT user_id, max(seen) AS last_seen
  FROM (
    SELECT "userId" AS user_id, "expires" - interval '30 days' AS seen FROM "sessions"
    UNION ALL
    SELECT "userId" AS user_id, "createdAt" AS seen FROM "audit_logs" WHERE "userId" IS NOT NULL
  ) seen_at
  GROUP BY user_id
) t
WHERE t.user_id = u."id";
