'use client'

/**
 * GET-форма фильтров, которая отправляется сама при смене выпадающего списка.
 *
 * Раньше на публичных страницах после выбора фильтра нужно было ещё нажать
 * «Применить». Поле поиска по-прежнему отправляется по Enter или кнопке:
 * отправлять форму на каждую букву было бы хуже. Номер страницы в форму не
 * входит, поэтому смена фильтра возвращает на первую.
 */
export function AutoSubmitForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      method="get"
      className={className}
      onChange={event => {
        if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit()
      }}
    >
      {children}
    </form>
  )
}
