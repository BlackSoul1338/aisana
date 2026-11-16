import type { Metadata } from 'next'
import { Building2, FileText, Mail, MessageSquare } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { FeedbackForm } from '@/components/contacts/FeedbackForm'

export const metadata: Metadata = {
  title: 'Контакты',
  description: 'Связаться с командой портала AiSana: доступ для вузов, добавление проектов, вопросы и сообщения об ошибках',
}

export default function ContactsPage() {
  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Контакты и обратная связь</h1>
        <p className="mt-1 text-sm text-slate-500">
          Портал ведёт АО «НАРИ «QazInnovations» совместно с вузами Казахстана
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Написать нам</h2>
          </div>
          <FeedbackForm />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">Оператор портала</h2>
            </div>
            <p className="text-sm text-slate-600">АО «Национальное агентство по развитию инноваций «QazInnovations»</p>
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
              <h2 className="text-sm font-semibold text-slate-800">Представителям вузов</h2>
            </div>
            <p className="text-sm text-slate-600">
              Как получить доступ, добавить проект и приложить документы — в инструкции.
            </p>
            <a
              href="/docs/instrukciya-dlya-vuzov.docx"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Скачать инструкцию
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">С чем обращаются чаще всего</h2>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>· доступ к админ-панели для сотрудника вуза</li>
              <li>· доступ к каталогу решений для представителя компании</li>
              <li>· добавить или исправить проект</li>
              <li>· ошибка или неточность на портале</li>
            </ul>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
