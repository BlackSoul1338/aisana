# Национальная карта ИИ-решений вузов МНВО РК (AiSana)

Веб-платформа для мониторинга и анализа ИИ-проектов университетов Казахстана.

## Стек технологий

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **UI:** Recharts, React Simple Maps, Framer Motion, Lucide Icons
- **Backend:** Next.js API Routes
- **БД:** PostgreSQL 16 + Prisma ORM
- **ИИ-поиск:** Google Gemini API
- **Деплой:** Docker (compose: db + migrate + app + backup)

---

## Быстрый старт (локально)

### 1. Клонирование и установка

```bash
git clone <repo-url>
cd ai-map-kz
npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
POSTGRES_PASSWORD=<надёжный-пароль>
DATABASE_URL="postgresql://postgres:<надёжный-пароль>@localhost:5432/ai_map_kz"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GEMINI_API_KEY=<ключ из https://aistudio.google.com/app/apikey>
```

### 3. База данных

```bash
# Применить миграции (ничего не удаляет, только закоммиченные миграции)
npx prisma migrate deploy

# Базовый сид: 20 регионов, 7 групп технологий, админ (создаётся только если админов нет)
npm run db:seed
```

> **Демо-данных больше нет.** Сид не создаёт вузы и проекты — рабочая база
> уже наполнена реальными данными. Свежие дампы лежат в `./backups/*.dump`.
> На чистой базе данные добавляются через админку или импорт из Excel/CSV
> (`/admin/import`).

### 4. Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

Вход в админку: `/login` → `admin@mnvo.kz`.
Пароль задаётся переменной `ADMIN_PASSWORD` в `.env`; если она не задана,
сид сгенерирует случайный и напечатает его в лог (`npm run db:seed`).

---

## Запуск через Docker / Podman

```bash
docker compose up -d --build          # Docker
podman-compose up -d --build          # Podman (rootless)
```

Перед первым запуском на Podman создай внешний том с данными БД
(в `docker-compose.yml` он объявлен как `external`):

```bash
podman volume create ai_mapkz_postgres_data
```

Больше ничего запускать не нужно:

- сервис **migrate** сам применяет миграции (`prisma migrate deploy`) и сид,
  на существующей базе при необходимости делает baseline `0_init`;
- сервис **backup** делает `pg_dump` раз в сутки в `./backups`
  (дампы старше 14 дней удаляются; вручную: `docker compose exec backup /backup.sh once`);
- **db** (PostgreSQL 16) наружу не пробрасывается — доступен только внутри docker-сети;
- **app** слушает `:3000`, состояние — `GET /api/health`.

Сборка не требует интернета: шрифт Inter лежит в репозитории
(`src/app/fonts/inter-var.woff2`), а не скачивается с Google Fonts.

Загруженные PDF хранятся в Vercel Blob, если задан `BLOB_READ_WRITE_TOKEN`.
Без токена приложение пишет их на диск (том `uploads_data`, путь
`/app/uploads_data`) и отдаёт через тот же приватный роут `/uploads/[filename]`.

### Модели Gemini и квота

Квота Free Tier — 20 запросов в сутки **на каждую модель**, и модели делятся
на независимые «корзины»: кончилась квота у `gemini-3.6-flash` — у
`gemini-3.5-flash-lite` она ещё есть. Поэтому портал распределяет задачи так:

| Задача | Модель | Переменная |
|---|---|---|
| Краткое резюме (простая) | `gemini-3.5-flash-lite` | `GEMINI_MODEL_LITE` |
| Пояснения по проектам (сложная) | `gemini-3.6-flash` | `GEMINI_MODEL` |

Если у модели исчерпана квота или она перегружена (429/503), запрос
автоматически переносится на следующую модель из `GEMINI_MODEL_FALLBACKS`.
Исчерпанная модель запоминается на 10 минут, чтобы не стучаться в неё снова.

Учтите: `gemini-3.5-flash` и `gemini-3.6-flash` делят **одну** квоту —
запрос к `3.5-flash` отвечает бэкендом `3.6-flash`. Ставить их рядом в цепочке
бессмысленно.

Ответы модели кэшируются в Postgres на 24 часа, поэтому повторный тот же
запрос не обращается к API вовсе.

---

## Роли и доступ

| Роль | Права |
|------|-------|
| `ADMIN` | Всё: вузы, проекты, слушания, пользователи, импорт, аудит |
| `EDITOR` | Весь контент (вузы, проекты, слушания, импорт), без пользователей |
| `UNIVERSITY_REP` | Только проекты и файлы **своего** вуза |
| `VIEWER` | Просмотр админки без права записи |

Защита: сессии в БД (httpOnly-cookie, 30 дней), rate limiting логина
(5 попыток на IP+email / 20 на IP за 15 мин), журнал аудита всех изменений.

---

## Структура проекта

```
src/
├── app/
│   ├── page.tsx                 # Главная — интерактивная карта
│   ├── dashboard/               # Дашборд со статистикой
│   ├── universities/            # Список и детали вузов
│   ├── projects/                # Список и детали проектов
│   ├── regions/[code]/          # Страница региона
│   ├── best-practices/          # Лучшие практики
│   ├── hearings/                # Заслушивания
│   ├── ai-search/               # ИИ-поиск проектов (Gemini)
│   ├── login/                   # Вход
│   ├── admin/                   # Админка
│   │   ├── universities/        # CRUD вузов
│   │   ├── projects/            # CRUD проектов
│   │   ├── hearings/            # CRUD заслушиваний
│   │   ├── users/               # Пользователи и роли
│   │   ├── import/              # Импорт вузов/проектов из Excel/CSV
│   │   └── audit/               # Журнал аудита
│   ├── api/                     # REST API (см. ниже)
│   ├── sitemap.ts / robots.ts   # SEO
├── components/
│   ├── layout/                  # Navbar, PageLayout
│   ├── map/                     # Карта Казахстана
│   ├── charts/                  # Recharts-компоненты
│   ├── forms/                   # Формы (проект, вуз, слушание)
│   ├── import/                  # Формы импорта
│   ├── project/                 # Паспорт агента, файлы, статистика
│   ├── auth/                    # Логин/логаут
│   └── ui/                      # Badges, Cards, Toaster
├── lib/
│   ├── prisma.ts                # Prisma client
│   ├── auth.ts                  # Сессии, роли, guard-функции
│   ├── rate-limit.ts            # Rate limiting и дедупликация счётчиков
│   ├── audit.ts                 # Журнал аудита
│   ├── schemas.ts               # Zod-схемы тел запросов
│   ├── llm-cache.ts             # Кэш ответов ИИ в Postgres
│   ├── project-import.ts        # Импорт проектов из Excel/CSV
│   ├── university-import.ts     # Импорт вузов из Excel/CSV
│   ├── uploads.ts               # Хранение PDF (Vercel Blob или диск)
│   ├── geminiSummary.ts         # Пояснения модели поверх готовой выдачи
│   ├── search/                  # Движок поиска: text, taxonomy, classify, engine, store
│   ├── data-cache.ts            # In-memory кэш тяжёлых выборок (60 сек)
│   └── i18n.ts / seo.ts / utils.ts
├── context/LangContext.tsx      # Переключение языка (ru/kz)
└── types/index.ts              # Общие типы

prisma/
├── schema.prisma               # Схема БД
├── migrations/                 # Миграции (migrate deploy)
├── seed.ts                     # Регионы, технологии, админ
└── seed-demo.ts                # ДЕМО-данные для локального стенда

docker/                         # backup.sh и разовые SQL-миграции
src/app/fonts/inter-var.woff2   # Inter (latin + cyrillic) — сборка не тянет Google Fonts
```

Тесты (`npm test`) — на чистые функции в `src/lib/search/`: без БД и без сети.

---

## API Reference

Публичные (без авторизации):

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/health` | Здоровье приложения и БД |
| POST | `/api/auth/login`, `/api/auth/logout` | Вход/выход |
| POST | `/api/feedback` | Обращение с формы контактов (rate limit 3/10 мин, 10/сутки) |

Требуют авторизации (роль в скобках):

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/me` | Текущий пользователь |
| GET | `/api/universities`, `/api/universities/:id` | Вузы |
| GET | `/api/projects`, `/api/projects/:id` | Проекты (поиск: `?q=&status=&category=`) |
| GET | `/api/hearings`, `/api/hearings/:id` | Заслушивания |
| POST | `/api/projects/:id/view` | Счётчик просмотров (дедуп по IP, 1/час) |
| POST | `/api/ai-search` | ИИ-поиск (ADMIN/EDITOR, rate limit 30/мин на IP). В ответе `aiAvailable` — доступна ли ИИ-часть |
| POST/PUT/DELETE | `/api/universities...` | CRUD вузов (ADMIN/EDITOR, удаление — ADMIN) |
| POST/PUT/DELETE | `/api/projects...` | CRUD проектов (+UNIVERSITY_REP для своего вуза) |
| PUT/DELETE | `/api/projects/:id/passport` | Паспорт ИИ-агента (PDF/ссылка) |
| GET/POST/DELETE | `/api/projects/:id/files` | Файлы проекта (акты, презентации, ссылки) |
| GET | `/uploads/:filename` | Отдача загруженного PDF (сессия обязательна) |
| POST/PUT/DELETE | `/api/hearings...` | CRUD заслушиваний (ADMIN/EDITOR) |
| POST | `/api/upload` | Загрузка PDF ≤4МБ (проверка магических байт) |
| POST | `/api/admin/import/projects` | Импорт проектов из .xlsx/.xls/.csv (dry-run поддерживается) |
| POST | `/api/admin/import/universities` | Импорт вузов (ADMIN/EDITOR) |
| POST/PATCH/DELETE | `/api/admin/users` | Пользователи (только ADMIN) |
| GET | `/api/export/dashboard` | Экспорт дашборда в Excel |
| GET | `/api/ai-search/models` | Диагностика моделей Gemini (ADMIN/EDITOR) |

---

## Добавление данных

- **Админка** → `/admin` (вузы, проекты, слушания, файлы, паспорта агентов)
- **Импорт из Excel/CSV** → `/admin/import` — сначала dry-run с отчётом об ошибках,
  затем боевой импорт; повторный импорт обновляет существующие записи
  (совпадение: вуз + название проекта)
- **API** — см. таблицу выше
- **Prisma Studio** → `npm run db:studio`

## Полезные команды

```bash
npm run dev          # Дев-сервер
npm run build        # Продакшен-сборка (интернет не нужен)
npm run lint         # ESLint
npm test             # Тесты (vitest, чистые функции поиска)
npm run db:migrate   # Новая миграция (dev)
npm run db:seed      # Сид (регионы/технологии/админ)
npm run db:seed:demo # ДЕМО-данные: вузы, проекты, тестовые учётки
npm run db:studio    # Prisma Studio
```

### Демо-данные для локального стенда

```bash
npm run db:seed:demo
```

Создаёт 5 вузов, 7 проектов (в том числе казахский и черновик на проверку)
и четыре учётки с паролем `demo12345`:

| Учётка | Роль | Что проверяет |
|---|---|---|
| `demo-admin@demo.kz` | ADMIN | Полный доступ |
| `demo-editor@demo.kz` | EDITOR | Контент без управления пользователями |
| `demo-rep@demo.kz` | UNIVERSITY_REP | Только свой вуз (ENU) |
| `demo-viewer@demo.kz` | VIEWER | Просмотр без записи |

После сида нажмите в админке «Пересчитать направления», чтобы проекты
получили тематические направления. Данные помечены префиксом `demo_` и
удаляются запросом к базе.

## Примечания по деплою

- Основной путь — **Docker / Podman** (`docker compose up -d --build`).
- Vercel возможен: загруженные PDF хранятся в Vercel Blob, для этого нужен
  `BLOB_READ_WRITE_TOKEN`. Переменные: `DATABASE_URL`, `GEMINI_API_KEY`,
  `NEXT_PUBLIC_APP_URL`.
- `NEXT_PUBLIC_APP_URL` укажите реальным доменом — используется в sitemap и OpenGraph.
- **Секреты:** `.env` в git не попадает. В `.env.example` — только плейсхолдеры.
  Пароль админа задаётся `ADMIN_PASSWORD`; если он не задан, сид генерирует
  случайный и печатает его в лог.
- **Перед коммитом:** проверьте, что в истории нет реальных ключей и паролей.
  `git log --all -p -- .env.example` не должен содержать значений.
