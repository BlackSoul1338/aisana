import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'

const VALID_ROLES = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.EDITOR,
  UserRole.UNIVERSITY_REP,
  UserRole.VIEWER,
])

export async function POST(request: NextRequest) {
  try {
    const { user: actor, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const data = await request.json()
    const email = String(data.email || '').trim().toLowerCase()
    const password = String(data.password || '')
    const role = data.role as UserRole

    if (!email || !password || !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: 'Email, пароль и роль обязательны' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }

    if (role === UserRole.UNIVERSITY_REP && !data.universityId) {
      return NextResponse.json({ error: 'Для представителя вуза нужно выбрать вуз' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name: data.name || null,
        password: hashedPassword,
        role,
        universityId: role === UserRole.UNIVERSITY_REP ? data.universityId : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        universityId: true,
      },
    })

    await audit(actor, 'CREATE', 'user', user.id, `${user.email} (${user.role})`)
    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
    }

    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Ошибка создания пользователя' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: currentUser, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const data = await request.json()
    const { id, name, email, password, role, universityId } = data

    if (!id) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name || null
    if (email) updateData.email = String(email).trim().toLowerCase()

    if (role && VALID_ROLES.has(role)) {
      // Prevent demoting the last remaining admin (including yourself)
      if (role !== UserRole.ADMIN) {
        const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
        if (target?.role === UserRole.ADMIN) {
          const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } })
          if (adminCount <= 1) {
            return NextResponse.json(
              { error: 'Нельзя понизить роль последнего администратора' },
              { status: 400 }
            )
          }
        }
      }
      updateData.role = role
      updateData.universityId = role === UserRole.UNIVERSITY_REP ? (universityId || null) : null
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
      }
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, universityId: true },
    })

    // Смена пароля отзывает все сессии пользователя: иначе старая cookie
    // продолжает работать и украденный пароль не даёт никакого эффекта.
    if (password) {
      await prisma.session.deleteMany({ where: { userId: user.id } })
    }

    await audit(currentUser, 'UPDATE', 'user', user.id, `${user.email} (${user.role})`)
    return NextResponse.json(user)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Email уже используется' }, { status: 409 })
    }
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })

    if (id === user.id) {
      return NextResponse.json({ error: 'Нельзя удалить собственный аккаунт' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    if (target.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Нельзя удалить последнего администратора — система останется без доступа к управлению' },
          { status: 400 }
        )
      }
    }

    await prisma.session.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })

    await audit(user, 'DELETE', 'user', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
