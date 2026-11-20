'use client'

import { LogOut } from 'lucide-react'
import { useLang } from '@/context/LangContext'

export function LogoutButton() {
  const { t } = useLang()
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
    >
      <LogOut size={14} />
      {t('admin', 'logout')}
    </button>
  )
}
