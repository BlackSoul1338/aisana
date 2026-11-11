'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload, Download } from 'lucide-react'

interface ImportError { row: number; message: string }
interface ImportResult {
  dryRun: boolean
  totalRows: number
  processed: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
}

export function UniversityImportForm() {
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const form = e.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement
    const file = fileInput.files?.[0]

    if (!file) {
      setError('Выберите файл для импорта')
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('dryRun', String(dryRun))

    try {
      const res = await fetch('/api/admin/import/universities', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось импортировать файл')
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Импорт вузов</h2>
            <p className="mt-1 text-sm text-slate-500">
              Поддерживаются Excel (.xlsx, .xls) и CSV. Первая строка — названия колонок.
              Если вуз с таким названием уже есть — он будет обновлён.
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Файл</label>
            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Проверить файл без записи в базу
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <Upload size={15} />
            {loading ? 'Обработка...' : dryRun ? 'Проверить файл' : 'Импортировать'}
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-800">
              {result.dryRun ? 'Проверка завершена' : 'Импорт завершён'}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              ['Строк',      result.totalRows],
              ['Обработано', result.processed],
              [result.dryRun ? 'Будет создано'   : 'Создано',   result.created],
              [result.dryRun ? 'Будет обновлено' : 'Обновлено', result.updated],
              ['Пропущено',  result.skipped],
            ] as [string, number][]).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-xl font-bold text-slate-800">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Ошибки ({result.errors.length})
              </h3>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-20">Строка</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Ошибка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.errors.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-500">{item.row}</td>
                        <td className="px-3 py-2 text-slate-700">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result.dryRun && result.created + result.updated > 0 && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              ✓ Успешно: создано {result.created}, обновлено {result.updated} вузов.{' '}
              <Link href="/universities" className="underline hover:no-underline">Перейти к вузам →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
