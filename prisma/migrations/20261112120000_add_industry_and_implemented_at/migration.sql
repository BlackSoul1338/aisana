-- Отрасль применения решения и место внедрения.
-- Обе колонки необязательные: существующие строки не меняются.
CREATE TYPE "ProjectIndustry" AS ENUM (
  'EDUCATION_SCIENCE', 'HEALTHCARE', 'FINANCE_BUSINESS', 'INDUSTRY_MINING', 'ENERGY',
  'AGRICULTURE', 'TRANSPORT', 'CONSTRUCTION', 'IT_SECURITY', 'GOVERNMENT', 'LAW',
  'ECOLOGY', 'CULTURE_TOURISM_SPORT', 'SOCIAL', 'OTHER'
);

ALTER TABLE "projects" ADD COLUMN "industry" "ProjectIndustry";
ALTER TABLE "projects" ADD COLUMN "implementedAt" TEXT;

CREATE INDEX "projects_industry_idx" ON "projects"("industry");
