'use client'

import { ProjectStatus } from '@prisma/client'
import { cn, STATUS_CONFIG } from '@/lib/utils'
import { useLang } from '@/context/LangContext'

interface Props {
  status: ProjectStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { t } = useLang()
  const config = STATUS_CONFIG[status]
  const label = t('status', status)
  return (
    <span
      title={label}
      className={cn(
        'inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full font-medium border',
        config.color,
        config.bg,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'
      )}
    >
      {label}
    </span>
  )
}
