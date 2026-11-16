'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@prisma/client'

interface University {
  id: string
  name: string
  shortName?: string | null
}

interface Props {
  universities: University[]
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'EDITOR', label: 'Редактор' },
  { value: 'UNIVERSITY_REP', label: 'Представитель вуза' },
  { value: 'VIEWER', label: 'Просмотр' },
  { value: 'BUSINESS_REP', label: 'Представитель бизнеса' },
]

export function UserCreateForm({ universities }: Props) {
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
        throw new Error(result.error || 'Не удалось создать пользователя')
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
          <label className={labelClass}>Имя</label>
          <input name="name" className={inputClass} placeholder="ФИО" />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" required className={inputClass} placeholder="user@example.kz" />
        </div>
        <div>
          <label className={labelClass}>Пароль</label>
          <input name="password" type="password" required minLength={6} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Роль</label>
          <select
            name="role"
            value={role}
            onChange={event => setRole(event.target.value as UserRole)}
            className={inputClass}
          >
            {ROLES.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {role === 'BUSINESS_REP' ? (
          <div className="md:col-span-2">
            <label className={labelClass}>Компания</label>
            <input name="organization" required maxLength={200} className={inputClass} placeholder="Название компании" />
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className={labelClass}>Вуз</label>
            <select name="universityId" required={role === 'UNIVERSITY_REP'} className={inputClass}>
              <option value="">Не привязан</option>
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
        {loading ? 'Создание...' : 'Создать пользователя'}
      </button>
    </form>
  )
}
