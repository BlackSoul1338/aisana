import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ProjectStatus, ProjectCategory } from '@prisma/client'
import { formatDate, formatDateLong } from '@/lib/datetime'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { formatDate, formatDateLong }

// Подписи статусов и категорий — в i18n (секции status/category), здесь только стили
export const STATUS_CONFIG: Record<ProjectStatus, { color: string; bg: string; border: string }> = {
  IDEA: { color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  PROTOTYPE: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  PILOT: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  IMPLEMENTED: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  SCALED: { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
}

export const CATEGORY_CONFIG: Record<ProjectCategory, { color: string; icon: string }> = {
  EDUCATION: { color: '#3b82f6', icon: '🎓' },
  SCIENCE: { color: '#8b5cf6', icon: '🔬' },
  MANAGEMENT: { color: '#f59e0b', icon: '📊' },
  ANALYTICS: { color: '#10b981', icon: '📈' },
  GENERATIVE_AI: { color: '#ec4899', icon: '🤖' },
  COMPUTER_VISION: { color: '#14b8a6', icon: '👁' },
  ROBOTICS: { color: '#f97316', icon: '⚙️' },
}
