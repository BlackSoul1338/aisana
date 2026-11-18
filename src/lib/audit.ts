import { prisma } from './prisma'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'LOGIN' | 'LOGOUT' | 'EXPORT'

/**
 * Запись действия администратора/редактора в журнал аудита.
 * Никогда не выбрасывает: сбой логирования не должен ломать основную операцию.
 * userEmail сохраняется снимком, чтобы запись оставалась читаемой
 * даже после удаления пользователя.
 */
export async function audit(
  user: { id: string; email: string } | null | undefined,
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  details?: string | null,
  context?: { ip?: string | null; userAgent?: string | null } | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userEmail: user?.email ?? 'unknown',
        action,
        entity,
        entityId: entityId ?? null,
        details: details ? details.slice(0, 1000) : null,
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
      },
    })
  } catch (error) {
    console.error('Audit log write failed:', error)
  }
}
