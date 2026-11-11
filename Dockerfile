FROM docker.io/library/node:20-alpine AS base

# ── deps stage ──────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.17.0 --activate

# Только манифесты: слой с зависимостями пересобирается реже
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── builder stage ────────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.17.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm exec prisma generate
RUN pnpm build

# ── runner stage ─────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# При pnpm зависимости — симлинки, и Next кладёт standalone во вложенный
# путь. Копируем содержимое корня standalone так, чтобы server.js
# оказался в /app/server.js. Сгенерированный Prisma-клиент и движок
# лежат внутри standalone/node_modules/.pnpm — отдельно копировать не нужно.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/ ./

# standalone не содержит public и статику — копируем их из builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Каталог для загруженных PDF, когда Vercel Blob недоступен.
# ВНЕ public/: public отдаётся статикой без проверки сессии, а файлы приватные.
RUN mkdir -p ./uploads_data && chown -R nextjs:nodejs ./uploads_data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
