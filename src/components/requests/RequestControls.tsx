'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IntegrationRequestStatus } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { REQUEST_STATUS_BADGE, REQUEST_STATUS_LABELS } from '@/lib/integration-requests'

interface Props {
  id: string
  status: IntegrationRequestStatus
  /** Статусы, в которые этот пользователь может перевести запрос (считает сервер) */
  nextStatuses: IntegrationRequestStatus[]
  operatorNote: string | null
  universityNote: string | null
  canEditOperatorNote: boolean
  canEditUniversityNote: boolean
  canSetProject: boolean
}

/** Работа с запросом в очереди: статус, заметка оператора, ответ вуза, проект. */
export function RequestControls(props: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/requests/${props.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось сохранить')
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const textarea = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
  const button = 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:opacity-50'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {props.nextStatuses.length > 0 ? (
          <select
            value={props.status}
            disabled={busy}
            onChange={event => save({ status: event.target.value })}
            className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${REQUEST_STATUS_BADGE[props.status]}`}
          >
            <option value={props.status}>{REQUEST_STATUS_LABELS[props.status]}</option>
            {props.nextStatuses.map(value => (
              <option key={value} value={value}>→ {REQUEST_STATUS_LABELS[value]}</option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${REQUEST_STATUS_BADGE[props.status]}`}>
            {REQUEST_STATUS_LABELS[props.status]}
          </span>
        )}
        {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {props.canSetProject && (
        <form
          onSubmit={event => {
            event.preventDefault()
            const raw = String(new FormData(event.currentTarget).get('project') || '').trim()
            // Принимаем и id, и ссылку на карточку вида /projects/<id>
            const projectId = raw.split('/projects/').pop()?.split(/[?#/]/)[0] || ''
            if (projectId) save({ projectId })
          }}
          className="flex gap-2"
        >
          <input
            name="project"
            placeholder="Ссылка на проект или его id"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={busy} className={button}>Привязать проект</button>
        </form>
      )}

      {props.canEditOperatorNote && (
        <NoteEditor
          label="Заметка оператора (видна только операторам)"
          initial={props.operatorNote}
          disabled={busy}
          className={textarea}
          buttonClassName={button}
          onSave={value => save({ operatorNote: value })}
        />
      )}

      {props.canEditUniversityNote && (
        <NoteEditor
          label="Ответ вуза (видят компания и оператор)"
          initial={props.universityNote}
          disabled={busy}
          className={textarea}
          buttonClassName={button}
          onSave={value => save({ universityNote: value })}
        />
      )}
    </div>
  )
}

function NoteEditor(props: {
  label: string
  initial: string | null
  disabled: boolean
  className: string
  buttonClassName: string
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(props.initial || '')
  const changed = value !== (props.initial || '')

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{props.label}</label>
      <textarea
        value={value}
        onChange={event => setValue(event.target.value)}
        rows={2}
        maxLength={4000}
        className={props.className}
      />
      {changed && (
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => props.onSave(value)}
          className={`mt-1 ${props.buttonClassName}`}
        >
          Сохранить
        </button>
      )}
    </div>
  )
}
