'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { useLang } from '@/context/LangContext'

export function ShareButton({ title }: { title: string }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href

    // Use native share sheet on mobile if available, otherwise copy to clipboard
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // user cancelled the share sheet — fall through to clipboard as backup
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API blocked (e.g. insecure context) — silently ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300 shrink-0"
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Share2 size={13} />}
      {copied ? t('project', 'copied') : t('project', 'share')}
    </button>
  )
}
