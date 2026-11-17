export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { UniversityForm } from '@/components/forms/UniversityForm'
import { BackButton } from '@/components/admin/BackButton'
import { UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function NewUniversityPage() {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/universities/new')
  const lang = await getRequestLang()

  const regions = await prisma.region.findMany({
    select: { id: true, name: true, nameKz: true, code: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <BackButton fallback="/admin/universities" />
      <h1 className="text-xl font-bold text-slate-800 mb-6">{t('universities', 'addUni', lang)}</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <UniversityForm regions={regions} />
      </div>
    </div>
  )
}
