-- Кэш ответов ИИ-модели.
-- Ответы стоят денег, поэтому хранятся в базе: переживают рестарт
-- контейнера и одинаковы для всех реплик приложения.
--
-- В cache_key входит хэш промпта (prompt_hash): правка промпта в коде
-- инвалидирует запись, иначе старые ответы выдавались бы как актуальные.
CREATE TABLE "llm_cache" (
    "cache_key"   TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "model"       TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_cache_pkey" PRIMARY KEY ("cache_key")
);

CREATE INDEX "llm_cache_expires_at_idx" ON "llm_cache" ("expires_at");
