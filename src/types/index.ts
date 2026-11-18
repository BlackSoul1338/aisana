import { ProjectCategory, ProjectStatus, UniversityType, UserRole, HearingDecision } from '@prisma/client'

export type { ProjectCategory, ProjectStatus, UniversityType, UserRole, HearingDecision }

export interface RegionWithStats {
  id: string
  name: string
  nameKz?: string | null
  code: string
  center?: string | null
  _count: {
    universities: number
  }
  universityCount: number
  projectCount: number
  implementedCount: number
}

export interface UniversityWithStats {
  id: string
  name: string
  nameKz?: string | null
  shortName?: string | null
  logo?: string | null
  regionId: string
  region: { id: string; name: string; code: string }
  address?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  rector?: string | null
  description?: string | null
  type: UniversityType
  _count: { projects: number }
}

export interface ProjectWithRelations {
  id: string
  title: string
  description: string
  universityId: string
  university: { id: string; name: string; shortName?: string | null; region: { name: string } }
  leadName?: string | null
  leadEmail?: string | null
  teamSize?: number | null
  launchDate?: Date | null
  category: ProjectCategory
  status: ProjectStatus
  technologies: { id: string; name: string; slug: string }[]
  isBestPractice: boolean
  isScalable: boolean
  impact?: string | null
  results?: string | null
  presentationPdf?: string | null
  presentationPptx?: string | null
  zoomLink?: string | null
  videoUrl?: string | null
  screenshots: string[]
  documentation?: string | null
  tags: string[]
  hearings?: HearingWithProject[]
  createdAt: Date
  updatedAt: Date
}

export interface HearingWithProject {
  id: string
  projectId: string
  project?: { title: string; university: { name: string } }
  date: Date
  commission: string[]
  remarks?: string | null
  recommendations?: string | null
  decision: HearingDecision
  decisionText?: string | null
  createdAt: Date
}

export interface DashboardStats {
  totalUniversities: number
  totalProjects: number
  implementedProjects: number
  inProgressProjects: number
  scalableProjects: number
  byRegion: { name: string; count: number }[]
  byStatus: { status: ProjectStatus; count: number }[]
  byCategory: { category: ProjectCategory; count: number }[]
  topUniversities: { name: string; shortName: string; count: number }[]
}

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  EDUCATION: 'Образование',
  SCIENCE: 'Наука',
  MANAGEMENT: 'Управление',
  ANALYTICS: 'Аналитика',
  GENERATIVE_AI: 'Генеративный ИИ',
  COMPUTER_VISION: 'Компьютерное зрение',
  ROBOTICS: 'Робототехника',
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  IDEA: 'Идея',
  PROTOTYPE: 'Прототип',
  PILOT: 'Пилот',
  IMPLEMENTED: 'Внедрено',
  SCALED: 'Масштабировано',
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  IDEA: '#94a3b8',
  PROTOTYPE: '#f59e0b',
  PILOT: '#3b82f6',
  IMPLEMENTED: '#10b981',
  SCALED: '#8b5cf6',
}

export const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  EDUCATION: '#3b82f6',
  SCIENCE: '#8b5cf6',
  MANAGEMENT: '#f59e0b',
  ANALYTICS: '#10b981',
  GENERATIVE_AI: '#ec4899',
  COMPUTER_VISION: '#14b8a6',
  ROBOTICS: '#f97316',
}
