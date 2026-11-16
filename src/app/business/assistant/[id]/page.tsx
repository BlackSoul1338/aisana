export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { getNeed, needMatches } from '@/lib/need-builder/service'
import { PageLayout } from '@/components/layout/PageLayout'
import { NeedAssistant } from '@/components/need/NeedAssistant'

export default async function NeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireRole([UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR], `/business/assistant/${id}`)

  // Потребность видит только автор
  const need = await getNeed(id, user.id)
  if (!need) notFound()

  return (
    <PageLayout>
      <Link href="/business/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Все подборы
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Подбор решения</h1>
      <NeedAssistant initialNeed={need} initialMatches={await needMatches(need)} aiEnabled={Boolean(process.env.GEMINI_API_KEY)} />
    </PageLayout>
  )
}
