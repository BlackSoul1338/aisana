import type { Metadata } from 'next'
import { Building2, FileText, Mail, MessageSquare } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { FeedbackForm } from '@/components/contacts/FeedbackForm'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang()
  return {
    title: t('contacts', 'metaTitle', lang),
    description: t('contacts', 'metaDesc', lang),
  }
}

export default async function ContactsPage() {
  const lang = await getRequestLang()
  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">{t('contacts', 'title', lang)}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('contacts', 'subtitle', lang)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">{t('contacts', 'writeTitle', lang)}</h2>
          </div>
          <FeedbackForm />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">{t('contacts', 'operatorTitle', lang)}</h2>
            </div>
            <p className="text-sm text-slate-600">{t('contacts', 'operatorName', lang)}</p>
            <a
              href="mailto:info@qazinn.kz"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Mail size={14} /> info@qazinn.kz
            </a>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">{t('contacts', 'forUni', lang)}</h2>
            </div>
            <p className="text-sm text-slate-600">
              {t('contacts', 'forUniText', lang)}
            </p>
            <a
              href="/docs/instrukciya-dlya-vuzov.docx"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              {t('contacts', 'downloadInstr', lang)}
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('contacts', 'faqTitle', lang)}</h2>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>· {t('contacts', 'faq1', lang)}</li>
              <li>· {t('contacts', 'faq2', lang)}</li>
              <li>· {t('contacts', 'faq3', lang)}</li>
              <li>· {t('contacts', 'faq4', lang)}</li>
            </ul>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
