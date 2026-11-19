'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLang } from '@/context/LangContext'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastListeners: ((toast: Toast) => void)[] = []
// Счётчик, а не Date.now(): два тоста в одну миллисекунду не должны делить id
let nextToastId = 0

export function showToast(message: string, type: Toast['type'] = 'info') {
  const toast: Toast = { id: String(++nextToastId), message, type }
  toastListeners.forEach(fn => fn(toast))
}

export function Toaster() {
  const { t } = useLang()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, 4000)
    }
    toastListeners.push(handler)
    return () => { toastListeners = toastListeners.filter(fn => fn !== handler) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in min-w-[260px] ${
            toast.type === 'success' ? 'bg-emerald-600' :
            toast.type === 'error' ? 'bg-red-600' : 'bg-slate-700'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            aria-label={t('common', 'close')}
            className="text-white/70 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
