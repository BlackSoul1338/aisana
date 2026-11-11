'use client'

import { useRouter } from 'next/navigation'
import { formatDateInput } from '@/lib/datetime'
import { useState, useRef } from 'react'
import { SaveToast } from '@/components/ui/SaveToast'
import { FileText, AlertCircle } from 'lucide-react'
import { AgentPassportViewer } from '@/components/project/AgentPassportViewer'
import { ProjectFilesManager } from '@/components/project/ProjectFilesManager'

interface University { id: string; name: string; shortName?: string | null }
interface Technology { id: string; name: string; slug: string }
interface ProjectFile { id: string; type: string; label: string; url: string; size?: number | null }

interface Project {
  id?: string
  title?: string
  description?: string
  universityId?: string
  leadName?: string | null
  leadEmail?: string | null
  teamSize?: number | null
  launchDate?: Date | string | null
  category?: string
  status?: string
  isBestPractice?: boolean
  isScalable?: boolean
  impact?: string | null
  results?: string | null
  agentPassportPdf?: string | null
  tags?: string[]
  technologies?: { id: string }[]
  files?: ProjectFile[]
}

interface Props {
  universities: University[]
  technologies: Technology[]
  project?: Project
  defaultUniversityId?: string
}

const CATEGORIES = [
  { value: 'EDUCATION', label: 'Образование' },
  { value: 'SCIENCE', label: 'Наука' },
  { value: 'MANAGEMENT', label: 'Управление' },
  { value: 'ANALYTICS', label: 'Аналитика' },
  { value: 'GENERATIVE_AI', label: 'Генеративный ИИ' },
  { value: 'COMPUTER_VISION', label: 'Компьютерное зрение' },
  { value: 'ROBOTICS', label: 'Робототехника' },
]

const STATUSES = [
  { value: 'IDEA', label: 'Идея' },
  { value: 'PROTOTYPE', label: 'Прототип' },
  { value: 'PILOT', label: 'Пилот' },
  { value: 'IMPLEMENTED', label: 'Внедрено' },
  { value: 'SCALED', label: 'Масштабировано' },
]

const TABS = [
  { id: 'main', label: 'Основное' },
  { id: 'passport', label: 'Паспорт агента' },
  { id: 'files', label: 'Файлы и ссылки' },
] as const

type TabId = typeof TABS[number]['id']

export function ProjectForm({ universities, technologies, project, defaultUniversityId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedTechs, setSelectedTechs] = useState<string[]>(
    project?.technologies?.map(t => t.id) || []
  )
  const isEdit = !!project?.id

  function toggleTech(id: string) {
    setSelectedTechs(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function formatDateForInput(d?: Date | string | null) {
    if (!d) return ''
    return formatDateInput(d)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const g = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value

    const teamSizeVal = g('teamSize')
    const data = {
      title: g('title'),
      description: g('description'),
      universityId: g('universityId'),
      leadName: g('leadName') || null,
      leadEmail: g('leadEmail') || null,
      teamSize: teamSizeVal ? parseInt(teamSizeVal) : null,
      launchDate: g('launchDate') || null,
      category: g('category'),
      status: g('status'),
      isBestPractice: (form.elements.namedItem('isBestPractice') as HTMLInputElement)?.checked,
      isScalable: (form.elements.namedItem('isScalable') as HTMLInputElement)?.checked,
      impact: g('impact') || null,
      results: g('results') || null,
      tags: g('tags') ? g('tags').split(',').map(t => t.trim()).filter(Boolean) : [],
      technologyIds: selectedTechs,
    }

    try {
      const url = isEdit ? `/api/projects/${project!.id}` : '/api/projects'
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

      if (isEdit) {
        // Остаёмся на странице (вкладки паспорта/файлов), показываем подтверждение
        router.refresh()
        setSaved(true)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaved(false), 3000)
      } else {
        // Новый проект: нативный переход в режим редактирования,
        // где открываются вкладки паспорта и файлов
        const created = await res.json()
        window.location.href = `/admin/projects/${created.id}/edit`
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main info + category + tech + results + materials + tags — all in one submit */}
      <form onSubmit={handleSubmit} className={tab === 'main' ? 'space-y-6' : 'hidden'}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        <SaveToast show={saved} />

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Основная информация</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Название проекта <span className="text-red-500">*</span></label>
              <input name="title" defaultValue={project?.title || ''} required className={inputCls} />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Описание <span className="text-red-500">*</span></label>
              <textarea name="description" defaultValue={project?.description || ''} required rows={4} className={`${inputCls} resize-none`} />
            </div>

            <div>
              <label className={labelCls}>Вуз <span className="text-red-500">*</span></label>
              <select name="universityId" defaultValue={project?.universityId || defaultUniversityId || ''} required className={inputCls}>
                <option value="">— Выберите вуз —</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.shortName ? `${u.shortName} — ` : ''}{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Дата запуска</label>
              <input name="launchDate" type="date" defaultValue={formatDateForInput(project?.launchDate)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Руководитель</label>
              <input name="leadName" defaultValue={project?.leadName || ''} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Email руководителя</label>
              <input name="leadEmail" type="email" defaultValue={project?.leadEmail || ''} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Размер команды</label>
              <input name="teamSize" type="number" min="1" defaultValue={project?.teamSize || ''} className={inputCls} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Категория и статус</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Категория <span className="text-red-500">*</span></label>
              <select name="category" defaultValue={project?.category || 'EDUCATION'} required className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Статус <span className="text-red-500">*</span></label>
              <select name="status" defaultValue={project?.status || 'IDEA'} required className={inputCls}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="isBestPractice" type="checkbox" defaultChecked={project?.isBestPractice || false} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-slate-700">Лучшая практика</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="isScalable" type="checkbox" defaultChecked={project?.isScalable || false} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-slate-700">Готово к тиражированию</span>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Технологии</h2>
          <div className="flex flex-wrap gap-2">
            {technologies.map(tech => (
              <button
                key={tech.id}
                type="button"
                onClick={() => toggleTech(tech.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selectedTechs.includes(tech.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {tech.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Результаты и влияние</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Влияние / Impact</label>
              <textarea name="impact" defaultValue={project?.impact || ''} rows={3} className={`${inputCls} resize-none`} placeholder="Количественные показатели эффекта..." />
            </div>
            <div>
              <label className={labelCls}>Результаты</label>
              <textarea name="results" defaultValue={project?.results || ''} rows={3} className={`${inputCls} resize-none`} placeholder="Достигнутые результаты..." />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Теги</h2>
          <div>
            <label className={labelCls}>Теги (через запятую)</label>
            <input name="tags" defaultValue={project?.tags?.join(', ') || ''} className={inputCls} placeholder="чат-бот, абитуриенты, NLP" />
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать проект'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/projects')}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Отмена
          </button>
        </div>
      </form>

      {/* Passport tab — only meaningful once the project exists */}
      {tab === 'passport' && (
        <div>
          {isEdit ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">Паспорт агента</h2>
                  <p className="text-xs text-slate-400 mt-0.5">PDF-документ с описанием ИИ-агента — отображается на странице проекта</p>
                </div>
              </div>
              <AgentPassportViewer projectId={project!.id!} initialUrl={project?.agentPassportPdf} canEdit />
            </div>
          ) : (
            <EmptyTabNotice text="Сначала сохраните основную информацию о проекте — после этого здесь можно будет загрузить паспорт агента." />
          )}
        </div>
      )}

      {/* Files tab — same story, needs an existing project id */}
      {tab === 'files' && (
        <div>
          {isEdit ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="mb-5 pb-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Файлы и ссылки</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Акты внедрения, презентации, документация, видеозаписи и внешние ссылки
                </p>
              </div>
              <ProjectFilesManager projectId={project!.id!} initialFiles={project?.files || []} />
            </div>
          ) : (
            <EmptyTabNotice text="Сначала сохраните основную информацию о проекте — после этого здесь можно будет прикреплять файлы и ссылки." />
          )}
        </div>
      )}
    </div>
  )
}

function EmptyTabNotice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-5">
      <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-700">{text}</p>
    </div>
  )
}
