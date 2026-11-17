'use client'

import { ProjectCategory } from '@prisma/client'
import { CATEGORY_CONFIG } from '@/lib/utils'
import { useLang } from '@/context/LangContext'

interface Props {
  category: ProjectCategory
}

export function CategoryBadge({ category }: Props) {
  const { t } = useLang()
  const config = CATEGORY_CONFIG[category]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: config.color }}
    >
      {config.icon} {t('category', category)}
    </span>
  )
}
