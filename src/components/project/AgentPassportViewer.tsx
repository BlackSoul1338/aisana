'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, Upload, Trash2, ExternalLink, Maximize2, X, Link2, Loader2 } from 'lucide-react'
import { toEmbedUrl } from '@/lib/embed'
import { useLang } from '@/context/LangContext'

interface Props {
  projectId: string
  initialUrl?: string | null
  canEdit?: boolean
  /** Ссылка изменилась (загрузка, замена, удаление) — для панели заполнения формы */
  onUrlChange?: (url: string) => void
}

export function AgentPassportViewer({ projectId, initialUrl, canEdit = false, onUrlChange }: Props) {
  const { t } = useLang()
  const [url, setUrl] = useState(initialUrl || '')
  const [mode, setMode] = useState<'closed' | 'upload' | 'link'>('closed')
  const [linkInput, setLinkInput] = useState(initialUrl || '')
  const [saving, setSaving] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { onUrlChange?.(url) }, [url, onUrlChange])

  async function saveUrl(newUrl: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/passport`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('project', 'saveFailed'))
      setUrl(newUrl)
      setMode('closed')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(file: File) {
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('project', 'loadFailed'))
      await saveUrl(data.url)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function removePassport() {
    if (!confirm(t('project', 'deleteConfirm'))) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/passport`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('project', 'deleteFailed'))
      }
      setUrl('')
      setLinkInput('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Fullscreen modal ──────────────────────────────────────
  if (fullscreen && url) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
          <div className="flex items-center gap-2 text-white">
            <FileText size={16} className="text-blue-400" />
            <span className="text-sm font-medium">{t('project', 'passportTitle')}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ExternalLink size={13} /> {t('project', 'openNewTab')}
            </a>
            <button onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={16} /> {t('project', 'close')}
            </button>
          </div>
        </div>
        <iframe src={toEmbedUrl(url, '#toolbar=1&navpanes=0')} className="flex-1 w-full" title={t('project', 'passportTitle')} />
      </div>
    )
  }

  // ── Upload picker (no PDF yet) ────────────────────────────
  if (!url) {
    return (
      <div className="space-y-4">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) handleFileUpload(file)
          }}
          className="flex flex-col items-center justify-center py-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-center"
        >
          <FileText size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">{t('project', 'passportNotLoaded')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('project', 'dropHint')}</p>

          {canEdit && (
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {t('project', 'uploadPdf')}
              </button>
              <button
                onClick={() => setMode('link')}
                className="flex items-center gap-2 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Link2 size={14} /> {t('project', 'pasteLink')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
              />
            </div>
          )}
          {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
        </div>

        {mode === 'link' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">{t('project', 'pdfLinkTitle')}</p>
            <p className="text-xs text-slate-500">
              {t('project', 'pdfLinkHint')}
            </p>
            <input
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              placeholder="https://drive.google.com/file/d/.../view"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <div className="flex gap-2">
              <button onClick={() => saveUrl(linkInput)} disabled={saving || !linkInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? t('project', 'saving') : t('common', 'save')}
              </button>
              <button onClick={() => setMode('closed')} className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm">
                {t('common', 'cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── PDF Viewer (passport exists) ──────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <FileText size={16} className="text-blue-500" />
          <span className="font-medium">{t('project', 'passportFile')}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors">
            <ExternalLink size={12} /> {t('project', 'open')}
          </a>
          <button onClick={() => setFullscreen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors">
            <Maximize2 size={12} /> {t('project', 'fullscreen')}
          </button>
          {canEdit && (
            <>
              <button onClick={() => fileInputRef.current?.click()} disabled={saving}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors">
                <Upload size={12} /> {t('project', 'replace')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
              />
              <button onClick={removePassport}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors">
                <Trash2 size={12} /> {t('common', 'delete')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50" style={{ height: '75vh' }}>
        <iframe
          src={toEmbedUrl(url, '#toolbar=1&navpanes=0&scrollbar=1')}
          className="w-full h-full"
          title={t('project', 'passportTitle')}
          loading="lazy"
        />
      </div>

      <p className="text-xs text-slate-400 text-center">
        {t('project', 'notRendered')}{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          {t('project', 'openDirectly')}
        </a>
      </p>
    </div>
  )
}
