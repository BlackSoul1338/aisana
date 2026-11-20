export const dynamic = 'force-dynamic'

import { UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { ProjectImportForm } from '@/components/import/ProjectImportForm'
import { UniversityImportForm } from '@/components/import/UniversityImportForm'
import { ImportTabs } from '@/components/import/ImportTabs'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'
import { CATEGORY_LABELS } from '@/types'

export default async function AdminImportPage() {
  const user = await requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP], '/admin/import')
  const lang = await getRequestLang()
  const canImportUniversities = user.role === UserRole.ADMIN || user.role === UserRole.EDITOR

  // Подписи — из i18n; список категорий/статусов/типов собираем из тех же ключей
  const categoryList = Object.keys(CATEGORY_LABELS).map(key => t('category', key, lang)).join(' / ')
  const statusList = ['IDEA', 'PROTOTYPE', 'PILOT', 'IMPLEMENTED', 'SCALED'].map(key => t('status', key, lang)).join(' / ')
  const typeList = ['typeState', 'typePrivate', 'typeNational', 'typeResearch'].map(key => t('universities', key, lang)).join(' / ')

  const PROJECT_COLUMNS = [
    [t('importSection', 'cPtitle', lang), t('importSection', 'cPtitleNote', lang)],
    [t('importSection', 'cPdesc', lang), t('importSection', 'cPdescNote', lang)],
    [t('importSection', 'cPuni', lang), t('importSection', 'cPuniNote', lang)],
    [t('importSection', 'cPcategory', lang), categoryList],
    [t('importSection', 'cPstatus', lang), statusList],
    [t('importSection', 'cPlead', lang), t('importSection', 'cPleadNote', lang)],
    ['Email', t('importSection', 'cPemailNote', lang)],
    [t('importSection', 'cPtech', lang), t('importSection', 'cPtechNote', lang)],
    [t('importSection', 'cPtags', lang), t('importSection', 'cPtechNote', lang)],
    [t('importSection', 'cPdate', lang), t('importSection', 'cPdateNote', lang)],
  ]

  const UNIVERSITY_COLUMNS = [
    [t('importSection', 'cUtitle', lang), t('importSection', 'cUtitleNote', lang)],
    [t('importSection', 'cUshort', lang), t('importSection', 'cUshortNote', lang)],
    [t('universityForm', 'nameKz', lang), t('importSection', 'cUkzNote', lang)],
    [t('importSection', 'cUregion', lang), t('importSection', 'cUregionNote', lang)],
    [t('universityForm', 'typeLabel', lang), typeList],
    [t('universities', 'rector', lang), t('importSection', 'cUrectorNote', lang)],
    [t('universityForm', 'address', lang), t('importSection', 'cUaddressNote', lang)],
    [t('universities', 'website', lang), 'https://...'],
    ['Email', t('importSection', 'cUemailNote', lang)],
    [t('universityForm', 'phone', lang), t('importSection', 'cUphoneNote', lang)],
    [t('universityForm', 'desc', lang), t('importSection', 'cUdescNote', lang)],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{t('importSection', 'title', lang)}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {canImportUniversities
            ? t('importSection', 'subtitleAll', lang)
            : t('importSection', 'subtitleProjects', lang)}
        </p>
      </div>

      <ImportTabs
        projectForm={<ProjectImportForm />}
        universityForm={<UniversityImportForm />}
        projectColumns={PROJECT_COLUMNS}
        universityColumns={UNIVERSITY_COLUMNS}
        showUniversitiesTab={canImportUniversities}
      />
    </div>
  )
}
