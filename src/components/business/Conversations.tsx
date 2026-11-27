import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Briefcase, FolderKanban } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { conversationSide, conversationsWhere, isUnread } from '@/lib/business'
import { formatDateLong } from '@/lib/utils'
import { ChatThread } from '@/components/business/ChatThread'

type BasePath = '/business/chats' | '/admin/chats'

/** Список диалогов пользователя: один и тот же для панели бизнеса и для вуза. */
export async function ConversationList({ user, basePath }: { user: AuthUser; basePath: BasePath }) {
  const conversations = await prisma.conversation.findMany({
    where: conversationsWhere(user),
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    include: {
      businessUser: { select: { name: true, organization: true } },
      university: { select: { name: true, shortName: true } },
      project: { select: { title: true } },
      request: { select: { title: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromBusiness: true } },
    },
  })

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        {basePath === '/business/chats'
          ? 'Диалогов пока нет. Напишите команде проекта с витрины или дождитесь предложения по вашей задаче.'
          : 'Диалогов пока нет. Они появятся, когда партнёр напишет команде проекта или вы предложите решение его задачи.'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map(conversation => {
        const side = conversationSide(user, conversation) ?? 'moderator'
        const unread = isUnread(side, conversation)
        const last = conversation.messages[0]
        const business = conversation.businessUser.organization || conversation.businessUser.name || 'Партнёр'
        const university = conversation.university.shortName || conversation.university.name
        return (
          <Link key={conversation.id} href={`${basePath}/${conversation.id}`}
            className={`block rounded-xl border bg-white p-4 transition-colors hover:border-blue-300 ${unread ? 'border-blue-300' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-slate-800">
                {side === 'business' ? university : side === 'university' ? business : `${business} ↔ ${university}`}
              </span>
              {unread && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">новое</span>}
              <span className="ml-auto text-xs text-slate-400">{formatDateLong(conversation.lastMessageAt)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {conversation.project && <>Проект: {conversation.project.title}</>}
              {conversation.project && conversation.request && ' · '}
              {conversation.request && <>Задача: {conversation.request.title}</>}
            </p>
            {last && (
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                <span className="text-slate-400">{last.fromBusiness ? business : university}: </span>{last.body}
              </p>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/** Страница диалога: шапка с темой и лента сообщений. */
export async function ConversationView({ user, id, basePath }: { user: AuthUser; id: string; basePath: BasePath }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      businessUser: { select: { name: true, organization: true } },
      university: { select: { name: true, shortName: true } },
      project: { select: { id: true, title: true, publication: true } },
      request: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: { id: true, body: true, fromBusiness: true, createdAt: true, sender: { select: { name: true } } },
      },
    },
  })
  const side = conversation ? conversationSide(user, conversation) : null
  if (!conversation || !side) notFound()

  // Открытие диалога отмечает его прочитанным для своей стороны
  if (side !== 'moderator') {
    await prisma.conversation.update({
      where: { id },
      data: side === 'business' ? { businessReadAt: new Date() } : { universityReadAt: new Date() },
    })
  }

  const business = conversation.businessUser.organization || conversation.businessUser.name || 'Партнёр'
  const university = conversation.university.shortName || conversation.university.name
  const requestHref = basePath === '/business/chats' ? '/business/requests' : '/admin/requests'

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} /> Все диалоги
      </Link>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Briefcase size={14} className="text-slate-400" /> {business}</span>
          <span className="inline-flex items-center gap-1.5"><Building2 size={14} className="text-slate-400" /> {conversation.university.name}</span>
        </div>
        {conversation.project && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-slate-500">
            <FolderKanban size={14} className="text-slate-400" /> Проект:{' '}
            {conversation.project.publication === 'PUBLISHED'
              ? <Link href={`/projects/${conversation.project.id}`} className="font-medium text-blue-600 hover:underline">{conversation.project.title}</Link>
              : <span className="font-medium text-slate-700">{conversation.project.title}</span>}
          </p>
        )}
        {conversation.request && (
          <p className="mt-1 text-slate-500">
            Задача партнёра:{' '}
            <Link href={`${requestHref}/${conversation.request.id}`} className="font-medium text-blue-600 hover:underline">{conversation.request.title}</Link>
          </p>
        )}
      </div>

      <ChatThread
        conversationId={conversation.id}
        side={side}
        businessLabel={business}
        universityLabel={university}
        initialMessages={conversation.messages.map(message => ({ ...message, createdAt: message.createdAt.toISOString() }))}
      />
    </div>
  )
}
