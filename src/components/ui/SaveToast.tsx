'use client'

import { CheckCircle } from 'lucide-react'
import { useLang } from '@/context/LangContext'

/** Всплывающее подтверждение сохранения (правый нижний угол). */
export function SaveToast({ show, text }: { show: boolean; text?: string }) {
  const { t } = useLang()
  if (!show) return null
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl"
    >
      <CheckCircle size={16} />
      {text ?? t('common', 'changesSaved')}
    </div>
  )
}
