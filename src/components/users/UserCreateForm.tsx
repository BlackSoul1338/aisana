'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { useLang } from '@/context/LangContext'

interface University {
  id: string
  name: string
  shortName?: string | null
}

interface Props {
  universities: University[]
}

const ROLE_ORDER: UserRole[] = ['ADMIN', 'EDITOR', 'UNIVERSITY_REP', 'VIEWER', 'BUSINESS_REP']

export function UserCreateForm({ universities }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('UNIVERSITY_REP')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = event.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      role,
      universityId: (form.elements.namedItem('universityId') as HTMLSelectElement | null)?.value || null,
      organization: (form.elements.namedItem('organization') as HTMLInputElement | null)?.value || null,
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || t('users', 'createFailed'))
      }

      form.reset()
      setRole('UNIVERSITY_REP')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('users', 'name')}</label>
          <input name="name" className={inputClass} placeholder={t('users', 'fullName')} />
        </div>
        <div>
          <label className={labelClass}>{t('login', 'email')}</label>
          <input name="email" type="email" required className={inputClass} placeholder="user@example.kz" />
        </div>
        <div>
          <label className={labelClass}>{t('login', 'password')}</label>
          <input name="password" type="password" required minLength={10} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('users', 'roleLabel')}</label>
          <select
            name="role"
            value={role}
            onChange={event => setRole(event.target.value as UserRole)}
            className={inputClass}
          >
            {ROLE_ORDER.map(role => (
              <option key={role} value={role}>{t('role', role)}</option>
            ))}
          </select>
        </div>
        {role === 'BUSINESS_REP' ? (
          <div className="md:col-span-2">
            <label className={labelClass}>{t('users', 'company')}</label>
            <input name="organization" required maxLength={200} className={inputClass} placeholder={t('users', 'companyPlaceholder')} />
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className={labelClass}>{t('project', 'university')}</label>
            <select name="universityId" required={role === 'UNIVERSITY_REP'} className={inputClass}>
              <option value="">{t('users', 'notAttached')}</option>
              {universities.map(university => (
                <option key={university.id} value={university.id}>
                  {university.shortName ? `${university.shortName} - ` : ''}{university.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? t('users', 'creating') : t('users', 'create')}
      </button>
    </form>
  )
}
