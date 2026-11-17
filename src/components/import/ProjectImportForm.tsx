'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { useLang } from '@/context/LangContext'

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  dryRun: boolean
  totalRows: number
  processed: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
}

export function ProjectImportForm() {
  const { t } = useLang()
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const form = event.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement
    const file = fileInput.files?.[0]

    if (!file) {
      setError(t('importSection', 'chooseFile'))
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('dryRun', String(dryRun))

    try {
      const response = await fetch('/api/admin/import/projects', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('importSection', 'importFailed'))

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">{t('importSection', 'importProjectsTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('importSection', 'projectsFormat')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('importSection', 'file')}</label>
            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={event => setDryRun(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            {t('importSection', 'dryRun')}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={15} />
            {loading ? t('importSection', 'checking') : dryRun ? t('importSection', 'checkFile') : t('importSection', 'import')}
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-800">
              {result.dryRun ? t('importSection', 'checkDone') : t('importSection', 'importDone')}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              [t('importSection', 'rows'), result.totalRows],
              [t('importSection', 'processed'), result.processed],
              [result.dryRun ? t('importSection', 'willCreate') : t('importSection', 'created'), result.created],
              [result.dryRun ? t('importSection', 'willUpdate') : t('importSection', 'updated'), result.updated],
              [t('importSection', 'skippedRows'), result.skipped],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-xl font-bold text-slate-800">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('importSection', 'firstErrors')}</h3>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{t('importSection', 'row')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{t('importSection', 'errorWord')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.errors.map(item => (
                      <tr key={`${item.row}-${item.message}`}>
                        <td className="px-3 py-2 text-slate-500">{item.row}</td>
                        <td className="px-3 py-2 text-slate-700">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
