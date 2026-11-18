-- Токены сессий в базе хранить в виде sha256: утечка дампа не даёт готовых
-- токенов входа. Существующие сессии перехешируются на месте.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Просроченные удаляем полностью, живые — перехешируем
DELETE FROM sessions WHERE expires <= now();
UPDATE sessions SET "sessionToken" = encode(digest("sessionToken", 'sha256'), 'hex');
