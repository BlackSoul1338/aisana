import { PrismaClient } from '@prisma/client'

/**
 * Ограничение пула на один экземпляр функции.
 *
 * Пока база отдаёт прямое подключение (роль prisma_migration, потолок в 50
 * соединений на всё приложение), Prisma по умолчанию открывает до девяти
 * соединений на экземпляр — и нескольких параллельных запросов хватает,
 * чтобы упереться в лимит и получить P2037. На serverless одного соединения
 * достаточно: экземпляр обслуживает один запрос за раз.
 *
 * Это подстраховка, а не решение. Правильное — включить Connection pooling
 * на стороне Prisma; после этого параметр просто перестанет играть роль.
 *
 * Если DATABASE_URL окажется не обычной postgres-строкой (например, адресом
 * Accelerate), ничего не меняем — там пул уже есть.
 */
function pooledDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) return undefined

  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '1')
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '20')
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

const datasourceUrl = pooledDatasourceUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
