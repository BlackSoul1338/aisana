import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { deleteIdSchema, parseBody, userCreateSchema, userUpdateSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const { user: actor, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(userCreateSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data
    const email = data.email.trim().toLowerCase()
    const password = data.password
    const role = data.role as UserRole

    if (role === UserRole.UNIVERSITY_REP && !data.universityId) {
      return NextResponse.json({ error: 'Для представителя вуза нужно выбрать вуз' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
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

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(userUpdateSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { id, name, email, password, role, universityId } = parsed.data

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name || null
    if (email) updateData.email = email.trim().toLowerCase()

    // Роль уже проверена схемой userUpdateSchema — enum из ролей
    if (role) {
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
      await prisma.session.deleteMany({ where: { userId: id } })
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

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(deleteIdSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { id } = parsed.data

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
