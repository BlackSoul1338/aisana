-- Витрина решений для бизнеса: проект открыт для пилота и внедрения.
-- Константа по умолчанию — существующие строки не требуют обновления.
ALTER TABLE "projects" ADD COLUMN "availableForIntegration" BOOLEAN NOT NULL DEFAULT false;
