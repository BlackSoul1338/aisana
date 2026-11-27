'use client'

import { CheckCircle2, CircleAlert, XCircle, BadgeCheck } from 'lucide-react'
import { cardChecklist, hasDemo, hasDocuments, isConfirmed, SHORT_DESCRIPTION_LENGTH, type ChecklistInput } from '@/lib/card-checklist'
import { cardProgress } from '@/lib/card-progress'
import { isDeployedStatus, MIN_DESCRIPTION_LENGTH } from '@/lib/project-completeness'
import { useLang } from '@/context/LangContext'

interface Props {
  /** Текущие значения формы и материалы карточки; null — форма ещё не прочитана */
  values: ChecklistInput | null
}

/**
 * «Заполнено N %» рядом с формой карточки: что есть, чего нет, что слишком
 * коротко. Считается на клиенте теми же правилами, что и подтверждение на
 * сервере (lib/card-checklist), без запросов.
 */
export function CardProgress({ values }: Props) {
  const { t } = useLang()
  if (!values) return null

  const items = cardChecklist(values)
  const missing = new Map(items.map(item => [item.key, item]))
  const percent = cardProgress(values)
  const confirmed = isConfirmed(values)
  const descriptionLength = (values.description ?? '').replace(/\s+/g, ' ').trim().length

  // Подписи полей берём из существующих ключей формы и карточки
  const label: Record<string, string> = {
    description: t('importSection', 'cPdesc'),
    documents: t('cardProgress', 'documents'),
    demo: t('cardProgress', 'demo'),
    implementedAt: t('project', 'implementedWhere'),
    results: t('project', 'results'),
    impact: t('project', 'impact'),
    leadName: t('project', 'lead'),
  }

  const done = [
    !missing.has('description') && !missing.has('shortDescription') && 'description',
    hasDocuments(values) && 'documents',
    hasDemo(values) && 'demo',
    isDeployedStatus(values.status) && !missing.has('implementedAt') && 'implementedAt',
    !missing.has('results') && 'results',
    !missing.has('impact') && 'impact',
    !missing.has('leadName') && 'leadName',
  ].filter((key): key is string => Boolean(key))

  const absent = items.filter(item => item.key !== 'shortDescription')
  const short = missing.has('shortDescription')

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-4 text-sm" aria-live="polite">
      <h2 className="font-semibold text-slate-800">{t('cardProgress', 'filled').replace('{n}', String(percent))}</h2>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
      </div>

      <p className={`mt-3 flex items-center gap-1.5 font-medium ${confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
        {confirmed ? <BadgeCheck size={16} className="shrink-0" /> : <CircleAlert size={16} className="shrink-0" />}
        {t('cardProgress', confirmed ? 'confirmed' : 'notConfirmed')}
      </p>
      {!confirmed && (
        <p className="mt-1 text-xs text-slate-500">{t('cardProgress', 'rule').replace('{min}', String(MIN_DESCRIPTION_LENGTH))}</p>
      )}

      {absent.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('cardProgress', 'missing')}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {absent.map(item => (
              <li key={item.key} className="flex items-start gap-1.5 text-slate-700">
                <XCircle size={15} className={`mt-0.5 shrink-0 ${item.level === 'required' ? 'text-red-500' : 'text-amber-500'}`} />
                <span>
                  {/* Без документа и демо чек-лист выдаёт один пункт «нет подтверждений» */}
                  {item.key === 'documents' && item.level === 'required' ? t('cardProgress', 'evidence') : label[item.key]}
                  {item.level === 'required' && <span className="ml-1 text-xs text-red-600">({t('cardProgress', 'required')})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {short && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('cardProgress', 'short')}</h3>
          <p className="mt-1.5 flex items-start gap-1.5 text-slate-700">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-500" />
            {t('cardProgress', 'shortDescription').replace('{n}', String(descriptionLength)).replace('{target}', String(SHORT_DESCRIPTION_LENGTH))}
          </p>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('cardProgress', 'done')}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {done.map(key => (
              <li key={key} className="flex items-start gap-1.5 text-slate-700">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                {label[key]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(missing.has('documents') || missing.has('demo')) && (
        <p className="mt-4 text-xs text-slate-400">{t('cardProgress', 'filesHint')}</p>
      )}
    </aside>
  )
}
