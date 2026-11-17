import { cookies } from 'next/headers'
import type { Lang } from '@/lib/i18n'

export const LANG_COOKIE = 'lang'

/** Язык текущего запроса по cookie 'lang' (ru по умолчанию). Только RSC/роуты. */
export async function getRequestLang(): Promise<Lang> {
  const store = await cookies()
  return store.get(LANG_COOKIE)?.value === 'kz' ? 'kz' : 'ru'
}
