'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { showToast } from '@/components/ui/toaster'

const BUTTON = 'flex items-center gap-1 text-xs text-red-500 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50'

/** Кнопка «Удалить» с окном подтверждения: общая для вуза, проекта и заслушивания. */
function DeleteButton({ url, title, done, children }: {
  url: string
  title: string
  /** Сообщение после успешного удаления */
  done: string
  children: React.ReactNode
}) {
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
        throw new Error(err.error || 'Ошибка удаления')
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
        Удалить
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        confirmLabel="Удалить"
        busyLabel="Удаление..."
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
  return (
    <DeleteButton url={`/api/universities/${id}`} title="Удалить вуз?" done={`Вуз «${name}» удалён`}>
      <span className="font-medium text-slate-700">{name}</span> будет удалён без возможности восстановления.{' '}
      {projectCount
        ? <span className="font-medium text-red-600">Вместе с ним удалятся все его проекты: {projectCount}.</span>
        : 'Вместе с ним удалятся все его проекты.'}
    </DeleteButton>
  )
}

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  return (
    <DeleteButton url={`/api/projects/${id}`} title="Удалить проект?" done="Проект удалён">
      Проект <span className="font-medium text-slate-700">«{name}»</span> будет удалён вместе с файлами и
      заслушиваниями, без возможности восстановления.
    </DeleteButton>
  )
}

export function DeleteHearingButton({ id }: { id: string }) {
  return (
    <DeleteButton url={`/api/hearings/${id}`} title="Удалить заслушивание?" done="Заслушивание удалено">
      Запись о заслушивании будет удалена без возможности восстановления.
    </DeleteButton>
  )
}
