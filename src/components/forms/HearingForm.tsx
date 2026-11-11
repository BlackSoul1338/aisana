'use client'

import { useRouter } from 'next/navigation'
import { formatDateInput } from '@/lib/datetime'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface Project { id: string; title: string; university: { shortName?: string | null; name: string } }

interface Hearing {
  id?: string
  projectId?: string
  date?: Date | string | null
  commission?: string[]
  remarks?: string | null
  recommendations?: string | null
  decision?: string
  decisionText?: string | null
}

interface Props {
  projects: Project[]
  hearing?: Hearing
  defaultProjectId?: string
}

const DECISIONS = [
  { value: 'PENDING', label: 'На рассмотрении' },
  { value: 'APPROVED', label: 'Одобрено' },
  { value: 'REJECTED', label: 'Отклонено' },
  { value: 'REVISION', label: 'На доработке' },
  { value: 'RECOMMENDED', label: 'Рекомендовано' },
]

export function HearingForm({ projects, hearing, defaultProjectId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [commission, setCommission] = useState<string[]>(hearing?.commission || [''])
  const isEdit = !!hearing?.id

  function formatDateForInput(d?: Date | string | null) {
    return formatDateInput(d)
  }

  function addMember() { setCommission(prev => [...prev, '']) }
  function removeMember(i: number) { setCommission(prev => prev.filter((_, idx) => idx !== i)) }
  function updateMember(i: number, val: string) {
    setCommission(prev => prev.map((m, idx) => idx === i ? val : m))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const g = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value

    const data = {
      projectId: g('projectId'),
      date: g('date'),
      commission: commission.filter(m => m.trim()),
      remarks: g('remarks') || null,
      recommendations: g('recommendations') || null,
      decision: g('decision'),
      decisionText: g('decisionText') || null,
    }

    try {
      const url = isEdit ? `/api/hearings/${hearing.id}` : '/api/hearings'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка сохранения')
      }
      // Нативный переход: возврат в список — явное подтверждение сохранения
      window.location.href = '/admin/hearings'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Проект <span className="text-red-500">*</span></label>
          <select name="projectId" defaultValue={hearing?.projectId || defaultProjectId || ''} required className={inputCls}>
            <option value="">— Выберите проект —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.university.shortName || p.university.name} — {p.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Дата заслушивания <span className="text-red-500">*</span></label>
          <input name="date" type="date" defaultValue={formatDateForInput(hearing?.date)} required className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Итоговое решение <span className="text-red-500">*</span></label>
          <select name="decision" defaultValue={hearing?.decision || 'PENDING'} required className={inputCls}>
            {DECISIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {/* Commission */}
      <div>
        <label className={labelCls}>Состав комиссии</label>
        <div className="space-y-2">
          {commission.map((member, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={member}
                onChange={e => updateMember(i, e.target.value)}
                placeholder={`Член комиссии ${i + 1}`}
                className={inputCls}
              />
              {commission.length > 1 && (
                <button type="button" onClick={() => removeMember(i)} className="text-red-400 hover:text-red-600 p-2">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addMember}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Добавить члена комиссии
          </button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Замечания</label>
        <textarea name="remarks" defaultValue={hearing?.remarks || ''} rows={3} className={`${inputCls} resize-none`} placeholder="Замечания комиссии..." />
      </div>

      <div>
        <label className={labelCls}>Рекомендации</label>
        <textarea name="recommendations" defaultValue={hearing?.recommendations || ''} rows={3} className={`${inputCls} resize-none`} placeholder="Рекомендации для улучшения..." />
      </div>

      <div>
        <label className={labelCls}>Текст решения</label>
        <textarea name="decisionText" defaultValue={hearing?.decisionText || ''} rows={3} className={`${inputCls} resize-none`} placeholder="Официальное решение комиссии..." />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать заслушивание'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
