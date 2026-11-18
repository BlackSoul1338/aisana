-- ── Одноразовый перенос легаси-ссылок проекта в систему файлов ──
-- Поля presentationPdf / presentationPptx / zoomLink / videoUrl /
-- documentation сохранялись, но нигде не показывались.
-- Переносим их в project_files (вкладка «Файлы и ссылки») и очищаем.
-- Перед запуском: docker compose exec backup /backup.sh once

BEGIN;

INSERT INTO project_files (id, "projectId", type, label, url)
SELECT gen_random_uuid()::text, p.id, 'PRESENTATION'::"ProjectFileType", 'Презентация (PDF)', btrim(p."presentationPdf")
FROM projects p
WHERE COALESCE(btrim(p."presentationPdf"), '') <> ''
  AND btrim(p."presentationPdf") ~* '^(https?://|/uploads/)'
  AND NOT EXISTS (SELECT 1 FROM project_files f WHERE f."projectId" = p.id AND f.url = btrim(p."presentationPdf"));

INSERT INTO project_files (id, "projectId", type, label, url)
SELECT gen_random_uuid()::text, p.id, 'PRESENTATION'::"ProjectFileType", 'Презентация (PPTX)', btrim(p."presentationPptx")
FROM projects p
WHERE COALESCE(btrim(p."presentationPptx"), '') <> ''
  AND btrim(p."presentationPptx") ~* '^(https?://|/uploads/)'
  AND NOT EXISTS (SELECT 1 FROM project_files f WHERE f."projectId" = p.id AND f.url = btrim(p."presentationPptx"));

INSERT INTO project_files (id, "projectId", type, label, url)
SELECT gen_random_uuid()::text, p.id, 'ZOOM'::"ProjectFileType", 'Zoom запись', btrim(p."zoomLink")
FROM projects p
WHERE COALESCE(btrim(p."zoomLink"), '') <> ''
  AND btrim(p."zoomLink") ~* '^(https?://|/uploads/)'
  AND NOT EXISTS (SELECT 1 FROM project_files f WHERE f."projectId" = p.id AND f.url = btrim(p."zoomLink"));

INSERT INTO project_files (id, "projectId", type, label, url)
SELECT gen_random_uuid()::text, p.id, 'VIDEO'::"ProjectFileType", 'Видеодемонстрация', btrim(p."videoUrl")
FROM projects p
WHERE COALESCE(btrim(p."videoUrl"), '') <> ''
  AND btrim(p."videoUrl") ~* '^(https?://|/uploads/)'
  AND NOT EXISTS (SELECT 1 FROM project_files f WHERE f."projectId" = p.id AND f.url = btrim(p."videoUrl"));

INSERT INTO project_files (id, "projectId", type, label, url)
SELECT gen_random_uuid()::text, p.id, 'DOCUMENTATION'::"ProjectFileType", 'Документация', btrim(p.documentation)
FROM projects p
WHERE COALESCE(btrim(p.documentation), '') <> ''
  AND btrim(p.documentation) ~* '^(https?://|/uploads/)'
  AND NOT EXISTS (SELECT 1 FROM project_files f WHERE f."projectId" = p.id AND f.url = btrim(p.documentation));

-- Очищаем легаси-поля, чтобы данные не жили в двух местах
UPDATE projects SET
  "presentationPdf" = NULL,
  "presentationPptx" = NULL,
  "zoomLink" = NULL,
  "videoUrl" = NULL,
  documentation = NULL
WHERE "presentationPdf" IS NOT NULL OR "presentationPptx" IS NOT NULL
   OR "zoomLink" IS NOT NULL OR "videoUrl" IS NOT NULL OR documentation IS NOT NULL;

COMMIT;

-- Контроль: сколько файлов каждого типа стало
SELECT type, count(*) AS files FROM project_files GROUP BY type ORDER BY files DESC;
