'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { showToast } from '@/components/ui/toaster'
import { useLang } from '@/context/LangContext'

const BUTTON = 'flex items-center gap-1 text-xs text-red-500 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50'

/** Кнопка «Удалить» с окном подтверждения: общая для вуза, проекта и заслушивания. */
function DeleteButton({ url, title, done, children }: {
  url: string
  title: string
  /** Сообщение после успешного удаления */
  done: string
  children: React.ReactNode
}) {
  const { t } = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('users', 'deleteFailed'))
      }
      setOpen(false)
      showToast(done, 'success')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(''); setOpen(true) }} className={BUTTON}>
        <Trash2 size={12} />
        {t('common', 'delete')}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        confirmLabel={t('common', 'delete')}
        busyLabel={t('users', 'deleting')}
        danger
        busy={busy}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      >
        {children}
      </ConfirmDialog>
    </>
  )
}

export function DeleteUniversityButton({ id, name, projectCount }: { id: string; name: string; projectCount?: number }) {
  const { t } = useLang()
  return (
    <DeleteButton url={`/api/universities/${id}`} title={t('delete', 'uniTitle')} done={`${t('delete', 'uniDone')} «${name}»`}>
      <span className="font-medium text-slate-700">{name}</span> {t('delete', 'uniDeleteText')}{' '}
      {projectCount
        ? <span className="font-medium text-red-600">{t('delete', 'withProjects')}: {projectCount}.</span>
        : t('delete', 'withProjects')}
    </DeleteButton>
  )
}

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const { t } = useLang()
  return (
    <DeleteButton url={`/api/projects/${id}`} title={t('delete', 'projectTitle')} done={`${t('delete', 'projectDone')} «${name}»`}>
      <span className="font-medium text-slate-700">«{name}»</span> {t('delete', 'projectDeleteText')}
    </DeleteButton>
  )
}

export function DeleteHearingButton({ id }: { id: string }) {
  const { t } = useLang()
  return (
    <DeleteButton url={`/api/hearings/${id}`} title={t('delete', 'hearingTitle')} done={t('delete', 'hearingDone')}>
      {t('delete', 'hearingDeleteText')}
    </DeleteButton>
  )
}
