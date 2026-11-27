'use client'

import { useRouter } from 'next/navigation'
import { formatDateInput } from '@/lib/datetime'
import { useState, useRef, useEffect } from 'react'
import { SaveToast } from '@/components/ui/SaveToast'
import { FileText, AlertCircle } from 'lucide-react'
import { AgentPassportViewer } from '@/components/project/AgentPassportViewer'
import { ProjectFilesManager } from '@/components/project/ProjectFilesManager'
import { INDUSTRIES } from '@/lib/industries'
import { MIN_DESCRIPTION_LENGTH } from '@/lib/project-completeness'
import { AiAssistPanel } from '@/components/forms/AiAssistPanel'
import { technologyLabel } from '@/lib/technologies'
import { useLang } from '@/context/LangContext'
import { CardProgress } from '@/components/forms/CardProgress'
import type { ChecklistInput } from '@/lib/card-checklist'

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
  industry?: string | null
  implementedAt?: string | null
  isBestPractice?: boolean
  isScalable?: boolean
  impact?: string | null
  results?: string | null
  agentPassportPdf?: string | null
  // Старые поля импорта: в форме их нет, но подтверждением они считаются
  videoUrl?: string | null
  presentationPdf?: string | null
  presentationPptx?: string | null
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

const CATEGORY_ORDER = ['EDUCATION', 'SCIENCE', 'MANAGEMENT', 'ANALYTICS', 'GENERATIVE_AI', 'COMPUTER_VISION', 'ROBOTICS'] as const
const STATUS_ORDER = ['IDEA', 'PROTOTYPE', 'PILOT', 'IMPLEMENTED', 'SCALED'] as const
const TABS = [
  { id: 'main', key: 'mainTab' },
  { id: 'passport', key: 'passportTitle' },
  { id: 'files', key: 'filesTitle' },
] as const

type TabId = typeof TABS[number]['id']

export function ProjectForm({ universities, technologies, project, defaultUniversityId }: Props) {
  const { t, lang } = useLang()
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
  // Место внедрения показываем обязательным, когда выбрана стадия «внедрено» или «масштабировано»
  const [status, setStatus] = useState(project?.status || 'IDEA')
  const deployed = status === 'IMPLEMENTED' || status === 'SCALED'

  const formRef = useRef<HTMLFormElement>(null)

  type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  const field = (name: string) => formRef.current?.elements.namedItem(name) as FormField | null

  // ИИ-помощник читает то, что введено сейчас, а не сохранённую карточку;
  // файлы и паспорт берутся из сохранённой — они загружаются на других вкладках
  function assistValues() {
    const value = (name: string) => field(name)?.value ?? ''
    return {
      title: value('title'),
      description: value('description'),
      impact: value('impact'),
      results: value('results'),
      status: value('status'),
      implementedAt: value('implementedAt'),
      leadName: value('leadName'),
      tags: value('tags').split(',').map(t => t.trim()).filter(Boolean),
      agentPassportPdf: project?.agentPassportPdf,
      files: project?.files,
    }
  }

  function applyText(name: 'description' | 'impact' | 'results', text: string) {
    const input = field(name)
    if (input) input.value = text
  }

  function applyTags(tags: string[]) {
    const input = field('tags')
    if (!input) return
    const current = input.value.split(',').map(t => t.trim()).filter(Boolean)
    const known = new Set(current.map(t => t.toLowerCase()))
    input.value = [...current, ...tags.filter(t => !known.has(t.toLowerCase()))].join(', ')
  }

  // Панель заполнения: текущие значения формы и материалы, загруженные на вкладках
  // паспорта и файлов. Вкладки монтируются заново, поэтому список живёт здесь
  const [files, setFiles] = useState(project?.files || [])
  const [passport, setPassport] = useState(project?.agentPassportPdf || '')
  const [progress, setProgress] = useState<ChecklistInput | null>(null)

  function refreshProgress() {
    setProgress({
      ...assistValues(),
      agentPassportPdf: passport,
      files,
      videoUrl: project?.videoUrl,
      presentationPdf: project?.presentationPdf,
      presentationPptx: project?.presentationPptx,
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshProgress, [files, passport])

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
      industry: g('industry') || null,
      implementedAt: g('implementedAt') || null,
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
        throw new Error(err.error || t('universityForm', 'saveFailed'))
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
    // На широком экране панель — колонка справа во всю высоту (вкладки и содержимое
    // — две строки первой колонки), на узком — блок под формой
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:grid-rows-[auto_1fr] xl:gap-x-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(tabItem => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === tabItem.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('projectForm', tabItem.key)}
          </button>
        ))}
      </div>

      {/* Main info, category, tech, results, materials, tags in one submit */}
      <form ref={formRef} onSubmit={handleSubmit} onChange={refreshProgress} className={tab === 'main' ? 'space-y-6' : 'hidden'}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        <SaveToast show={saved} />

        <AiAssistPanel getValues={assistValues} applyText={(name, text) => { applyText(name, text); refreshProgress() }} applyTags={applyTags} />

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">{t('projectForm', 'mainInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>{t('projectForm', 'title')} <span className="text-red-500">*</span></label>
              <input name="title" defaultValue={project?.title || ''} required className={inputCls} />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>{t('importSection', 'cPdesc')} <span className="text-red-500">*</span></label>
              <textarea name="description" defaultValue={project?.description || ''} required rows={4} className={`${inputCls} resize-none`}
                placeholder={t('projectForm', 'descPlaceholder')} />
              <p className="text-xs text-slate-400 mt-1">{t('projectForm', 'descMinPrefix')} {MIN_DESCRIPTION_LENGTH} {t('projectForm', 'descMinSuffix')}</p>
            </div>

            <div>
              <label className={labelCls}>{t('project', 'university')} <span className="text-red-500">*</span></label>
              <select name="universityId" defaultValue={project?.universityId || defaultUniversityId || ''} required className={inputCls}>
                <option value="">{t('users', 'selectUni')}</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.shortName ? `${u.shortName} - ` : ''}{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('project', 'launched')}</label>
              <input name="launchDate" type="date" defaultValue={formatDateForInput(project?.launchDate)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t('project', 'lead')}</label>
              <input name="leadName" defaultValue={project?.leadName || ''} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t('projectForm', 'leadEmailLabel')}</label>
              <input name="leadEmail" type="email" defaultValue={project?.leadEmail || ''} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t('projectForm', 'teamSize')}</label>
              <input name="teamSize" type="number" min="0" defaultValue={project?.teamSize || ''} className={inputCls} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">{t('projectForm', 'categoryStatus')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('importSection', 'cPcategory')} <span className="text-red-500">*</span></label>
              <select name="category" defaultValue={project?.category || 'EDUCATION'} required className={inputCls}>
                {CATEGORY_ORDER.map(c => <option key={c} value={c}>{t('category', c)}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('projectForm', 'statusLabel')} <span className="text-red-500">*</span></label>
              <select name="status" value={status} onChange={e => setStatus(e.target.value)} required className={inputCls}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{t('status', s)}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('project', 'industry')}</label>
              <select name="industry" defaultValue={project?.industry || ''} className={inputCls}>
                <option value="">{t('projectForm', 'notSelected')}</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i[lang]}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">{t('projectForm', 'industryHint')}</p>
            </div>

            <div>
              <label className={labelCls}>{t('project', 'implementedWhere')} {deployed && <span className="text-red-500">*</span>}</label>
              <input name="implementedAt" defaultValue={project?.implementedAt || ''} maxLength={2000} className={inputCls}
                placeholder={t('projectForm', 'implementedPlaceholder')} />
              <p className="text-xs text-slate-400 mt-1">{t('projectForm', 'reqHintPrefix')} «{t('status', 'IMPLEMENTED')}» {t('common', 'and')} «{t('status', 'SCALED')}».</p>
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="isBestPractice" type="checkbox" defaultChecked={project?.isBestPractice || false} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-slate-700">{t('project', 'bestPractice')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="isScalable" type="checkbox" defaultChecked={project?.isScalable || false} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-slate-700">{t('best', 'sectionScale')}</span>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">{t('project', 'technologies')}</h2>
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
                {technologyLabel(tech, lang)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">{t('projectForm', 'resultsSection')}</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('project', 'impact')}</label>
              <textarea name="impact" defaultValue={project?.impact || ''} rows={3} className={`${inputCls} resize-none`} placeholder={t('projectForm', 'impactPlaceholder')} />
            </div>
            <div>
              <label className={labelCls}>{t('project', 'results')}</label>
              <textarea name="results" defaultValue={project?.results || ''} rows={3} className={`${inputCls} resize-none`} placeholder={t('projectForm', 'resultsPlaceholder')} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">{t('project', 'tags')}</h2>
          <div>
            <label className={labelCls}>{t('projectForm', 'tagsLabel')}</label>
            <input name="tags" defaultValue={project?.tags?.join(', ') || ''} className={inputCls} placeholder={t('projectForm', 'tagsPlaceholder')} />
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? t('universityForm', 'saving') : isEdit ? t('universityForm', 'saveChanges') : t('projectForm', 'createProject')}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/projects')}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {t('common', 'cancel')}
          </button>
        </div>
      </form>

      {/* Passport tab: only meaningful once the project exists */}
      {tab === 'passport' && (
        <div>
          {isEdit ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">{t('project', 'passportTitle')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{t('projectForm', 'passportAgentNote')}</p>
                </div>
              </div>
              <AgentPassportViewer projectId={project!.id!} initialUrl={passport} canEdit onUrlChange={setPassport} />
            </div>
          ) : (
            <EmptyTabNotice text={t('projectForm', 'passportSaveFirst')} />
          )}
        </div>
      )}

      {/* Files tab: same story, needs an existing project id */}
      {tab === 'files' && (
        <div>
          {isEdit ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="mb-5 pb-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">{t('project', 'filesTitle')}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t('project', 'filesDesc')}
                </p>
              </div>
              <ProjectFilesManager projectId={project!.id!} initialFiles={files} onFilesChange={setFiles} />
            </div>
          ) : (
            <EmptyTabNotice text={t('projectForm', 'filesSaveFirst')} />
          )}
        </div>
      )}

      <div className="mt-6 xl:mt-0 xl:col-start-2 xl:row-start-1 xl:row-span-2">
        <CardProgress values={progress} />
      </div>
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
