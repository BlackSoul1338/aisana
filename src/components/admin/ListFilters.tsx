'use client'

import { Search, X } from 'lucide-react'

export interface FilterConfig {
  name: string            // имя query-параметра
  label: string           // подпись «Все …» в первом пункте
  options: { value: string; label: string }[]
}

interface Props {
  basePath: string
  values: Record<string, string | undefined>
  filters: FilterConfig[]
  searchPlaceholder?: string
  sortOptions?: { value: string; label: string }[]
}

/**
 * Панель фильтров для админ-списков.
 * Обычная GET-форма: смена значения отправляет форму нативно,
 * браузер делает полную загрузку страницы с новыми параметрами —
 * ровно как прямой заход по URL. Никакого клиентского роутера,
 * нечему кэшироваться и ломаться. Смена фильтра сбрасывает страницу
 * на первую автоматически (поле page в форме отсутствует).
 */
export function ListFilters({ basePath, values, filters, searchPlaceholder = 'Поиск…', sortOptions }: Props) {
  const submit = (e: { currentTarget: { form: HTMLFormElement | null } }) => {
    e.currentTarget.form?.requestSubmit()
  }

  const hasActiveFilters = Boolean(
    values.q || values.sort || filters.some(f => values[f.name])
  )

  return (
    <form method="get" action={basePath} className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="q"
          defaultValue={values.q || ''}
          placeholder={searchPlaceholder}
          className="pl-8 pr-3 py-2 w-56 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
      </div>

      {filters.map(f => (
        <select
          key={f.name}
          name={f.name}
          defaultValue={values[f.name] || ''}
          onChange={submit}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 max-w-[220px]"
        >
          <option value="">{f.label}</option>
          {f.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {sortOptions && (
        <select
          name="sort"
          defaultValue={values.sort || sortOptions[0].value}
          onChange={submit}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ml-auto"
        >
          {sortOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* Кнопка нужна для поиска (Enter тоже работает) и как запасной
          вариант применения фильтров, если JS не отработал */}
      <button
        type="submit"
        className="px-3.5 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-800 text-white transition-colors"
      >
        Применить
      </button>

      {hasActiveFilters && (
        <a
          href={basePath}
          className="flex items-center gap-1 px-2.5 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          title="Сбросить фильтры"
        >
          <X size={13} /> Сбросить
        </a>
      )}
    </form>
  )
}
