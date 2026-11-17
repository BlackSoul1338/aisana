'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, Search } from 'lucide-react'
import { useLang } from '@/context/LangContext'

interface Props {
  projectId: string
  viewCount: number
  searchHitCount: number
}

export function ProjectStats({ projectId, viewCount, searchHitCount }: Props) {
  const { t } = useLang()
  const [displayCount, setDisplayCount] = useState(viewCount)
  const firedRef = useRef(false)

  useEffect(() => {
    // Prevent double-firing on re-renders (e.g. parent state changes from tabs)
    if (firedRef.current) return
    firedRef.current = true

    // Avoid counting the same visitor multiple times within one browser session
    const sessionKey = `viewed-project-${projectId}`
    const alreadyViewed = sessionStorage.getItem(sessionKey)
    if (alreadyViewed) return

    fetch(`/api/projects/${projectId}/view`, { method: 'POST' })
      .then(res => res.ok ? res.json() : null)
      .then(() => {
        sessionStorage.setItem(sessionKey, '1')
        setDisplayCount(prev => prev + 1) // only bump UI once the request actually succeeded
      })
      .catch(() => { /* keep original count on failure, don't lie to the user */ })
  }, [projectId])

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Eye size={13} />
        <span className="font-medium text-slate-600">{displayCount}</span>
        <span>{t('project', 'viewsShort')}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Search size={13} />
        <span className="font-medium text-slate-600">{searchHitCount}</span>
        <span>{t('project', 'inAiSearch')}</span>
      </div>
    </div>
  )
}
