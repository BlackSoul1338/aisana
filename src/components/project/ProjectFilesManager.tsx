'use client'

import { useState, useEffect } from 'react'
import { FileText, Video, Link2, Trash2, Plus, ExternalLink, FileCheck, Loader2, AlertCircle } from 'lucide-react'
import { useLang } from '@/context/LangContext'

const FILE_TYPES = [
  { value: 'ACT',           key: 'fileTypeAct',          icon: FileCheck },
  { value: 'PRESENTATION',  key: 'fileTypePresentation', icon: FileText },
  { value: 'DOCUMENTATION', key: 'fileTypeDoc',          icon: FileText },
  { value: 'VIDEO',         key: 'fileTypeVideo',        icon: Video },
  { value: 'ZOOM',          key: 'fileTypeZoom',         icon: Video },
  { value: 'LINK',          key: 'fileTypeLink',         icon: Link2 },
  { value: 'OTHER',         key: 'fileTypeOther',        icon: FileText },
]

const TYPE_COLORS: Record<string, string> = {
  ACT:           'bg-emerald-100 text-emerald-700',
  PRESENTATION:  'bg-blue-100 text-blue-700',
  DOCUMENTATION: 'bg-slate-100 text-slate-700',
  VIDEO:         'bg-purple-100 text-purple-700',
  ZOOM:          'bg-violet-100 text-violet-700',
  LINK:          'bg-amber-100 text-amber-700',
  OTHER:         'bg-slate-100 text-slate-600',
}

interface ProjectFile {
  id: string
  type: string
  label: string
  url: string
  size?: number | null
}

interface Props {
  projectId: string
  initialFiles?: ProjectFile[]
  readonly?: boolean
  /** Список изменился (добавлен или удалён файл) — для панели заполнения формы */
  onFilesChange?: (files: ProjectFile[]) => void
}

function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(url.trim()) || url.trim().startsWith('/uploads/')
}

export function ProjectFilesManager({ projectId, initialFiles = [], readonly = false, onFilesChange }: Props) {
  const { t } = useLang()
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ type: 'PRESENTATION', label: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { onFilesChange?.(files) }, [files, onFilesChange])

  async function addFile() {
    setError('')

    if (!form.label.trim() || !form.url.trim()) {
      setError(t('project', 'fillRequired'))
      return
    }
    if (!isValidUrl(form.url)) {
      setError(t('project', 'urlMustBeHttp'))
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('project', 'addFailed'))
      }

      setFiles(prev => [...prev, data])
      setForm({ type: 'PRESENTATION', label: '', url: '' })
      setAdding(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm(t('project', 'deleteFileConfirm'))) return
    setDeletingId(fileId)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('project', 'deleteFileFailed'))
      }
      // Only remove from UI after the server confirms it's actually gone
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const getIcon = (type: string) => {
    const ft = FILE_TYPES.find(ft => ft.value === type)
    const Icon = ft?.icon || FileText
    return <Icon size={14} />
  }

  const getLabel = (type: string) => { const ft = FILE_TYPES.find(ft => ft.value === type); return ft ? t('project', ft.key) : type }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 group">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${TYPE_COLORS[file.type] || 'bg-slate-100 text-slate-600'}`}>
                {getIcon(file.type)}
                {getLabel(file.type)}
              </span>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-blue-600 hover:underline truncate flex items-center gap-1"
              >
                {file.label}
                <ExternalLink size={11} className="shrink-0 opacity-50" />
              </a>
              {!readonly && (
                <button
                  onClick={() => deleteFile(file.id)}
                  disabled={deletingId === file.id}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all disabled:opacity-100"
                >
                  {deletingId === file.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && readonly && (
        <p className="text-slate-400 text-sm py-2">{t('project', 'filesNotAttached')}</p>
      )}

      {!readonly && (
        <>
          {!adding ? (
            <button
              onClick={() => { setAdding(true); setError('') }}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> {t('project', 'addFileLink')}
            </button>
          ) : (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FILE_TYPES.map(ft => <option key={ft.value} value={ft.value}>{t('project', ft.key)}</option>)}
                </select>
                <input
                  placeholder={t('project', 'fileNamePlaceholder')}
                  value={form.label}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  placeholder="URL (https://...)"
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addFile}
                  disabled={saving || !form.label || !form.url}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? t('project', 'adding') : t('common', 'add')}
                </button>
                <button
                  onClick={() => { setAdding(false); setError('') }}
                  className="text-slate-500 hover:text-slate-700 px-4 py-1.5 text-sm"
                >
                  {t('common', 'cancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
