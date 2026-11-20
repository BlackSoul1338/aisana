import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  totalItems: number
  basePath: string
  searchParams: Record<string, string | undefined>
  /** Подпись перед числом: вызов передаёт локализованную подпись (вызывающая сторона — серверная). */
  totalLabel: string
}

/**
 * Пагинация на обычных <a href>: браузер делает полную загрузку
 * страницы с нужными параметрами — как прямой заход по URL.
 * Клиентский роутер Next не участвует. Активные фильтры сохраняются.
 */
export function Pagination({ page, totalPages, totalItems, basePath, searchParams, totalLabel }: Props) {
  const label = totalLabel
  if (totalPages <= 1) return null

  const href = (p: number): string => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value)
    }
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const navCls = (disabled: boolean) =>
    `flex items-center gap-1 px-3.5 py-2 rounded-lg border text-sm transition-colors ${
      disabled
        ? 'pointer-events-none opacity-40 border-slate-100 text-slate-400'
        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
    }`

  // Показываем: 1 … (page-1) page (page+1) … last
  const pages: (number | '…')[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-slate-400">{label}: {totalItems}</span>
      <div className="flex items-center gap-1.5">
        <a href={href(page - 1)} className={navCls(page <= 1)}><ChevronLeft size={14} /></a>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-slate-300 text-sm">…</span>
          ) : (
            <a
              key={p}
              href={href(p)}
              className={`min-w-[34px] text-center px-2 py-1.5 rounded-lg text-sm transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white font-medium pointer-events-none'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </a>
          )
        )}
        <a href={href(page + 1)} className={navCls(page >= totalPages)}><ChevronRight size={14} /></a>
      </div>
    </div>
  )
}
