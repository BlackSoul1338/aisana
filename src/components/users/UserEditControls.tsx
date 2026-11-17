'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, X, Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react'
import { UserRole } from '@prisma/client'

interface University { id: string; name: string; shortName?: string | null }
interface User {
  id: string
  name?: string | null
  email: string
  role: UserRole
  universityId?: string | null
  organization?: string | null
}

interface Props {
  user: User
  universities: University[]
  isSelf?: boolean
  isLastAdmin?: boolean
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'EDITOR', label: 'Редактор' },
  { value: 'UNIVERSITY_REP', label: 'Представитель вуза' },
  { value: 'VIEWER', label: 'Просмотр' },
  { value: 'BUSINESS_REP', label: 'Представитель бизнеса' },
]

export function UserEditControls({ user, universities, isSelf = false, isLastAdmin = false }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState(user.role)

  const blockedFromDemotion = isLastAdmin // last admin can't be demoted to a non-admin role
  const blockedFromDeletion = isSelf || isLastAdmin

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement)?.value

    const body: Record<string, any> = {
      id: user.id,
      name: g('name'),
      email: g('email'),
      role: g('role'),
      universityId: g('universityId') || null,
      organization: g('organization') || null,
    }
    const pw = g('password')
    if (pw) body.password = pw

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка')
      }
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка удаления')
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Pencil size={12} /> Изменить
        </button>

        {blockedFromDeletion ? (
          <span
            title={isSelf ? 'Нельзя удалить собственный аккаунт' : 'Это последний администратор — удаление заблокировано'}
            className="flex items-center gap-1 text-xs text-slate-300 border border-slate-100 px-2.5 py-1.5 rounded-lg cursor-not-allowed"
          >
            <Trash2 size={12} /> Удалить
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={12} /> Удалить
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Удалить пользователя?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Аккаунт <span className="font-medium text-slate-700">{user.email}</span> будет удалён без возможности восстановления.
                </p>
              </div>
            </div>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); setError('') }}
                disabled={deleting}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 text-lg">Редактировать пользователя</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
            )}

            {blockedFromDemotion && (
              <div className="mb-4 flex gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                Это последний администратор — роль нельзя изменить на другую, иначе никто не сможет управлять системой.
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя</label>
                <input name="name" defaultValue={user.name || ''} className={inputCls} placeholder="Полное имя" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input name="email" type="email" defaultValue={user.email} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Новый пароль
                  <span className="text-slate-400 font-normal ml-1">(оставьте пустым чтобы не менять)</span>
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    minLength={10}
                    className={`${inputCls} pr-10`}
                    placeholder="Минимум 10 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Роль</label>
                <select
                  name="role"
                  defaultValue={user.role}
                  disabled={blockedFromDemotion}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className={`${inputCls} ${blockedFromDemotion ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {role === 'UNIVERSITY_REP' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Вуз</label>
                  <select name="universityId" defaultValue={user.universityId || ''} className={inputCls}>
                    <option value="">— Выберите вуз —</option>
                    {universities.map(u => (
                      <option key={u.id} value={u.id}>{u.shortName ? `${u.shortName} — ` : ''}{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {role === 'BUSINESS_REP' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Компания <span className="text-red-500">*</span></label>
                  <input name="organization" defaultValue={user.organization || ''} required maxLength={200} className={inputCls} placeholder="Название компании" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
