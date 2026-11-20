import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma, UserRole } from '@prisma/client'
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

    if (role === UserRole.BUSINESS && !data.organization) {
      return NextResponse.json({ error: 'Для партнёра укажите организацию' }, { status: 400 })
    }

    if (role === UserRole.UNIVERSITY_REP) {
      if (!data.universityId) {
        return NextResponse.json({ error: 'Для представителя вуза нужно выбрать вуз' }, { status: 400 })
      }
      const university = await prisma.university.findUnique({
        where: { id: data.universityId },
        select: { id: true },
      })
      if (!university) {
        return NextResponse.json({ error: 'Университет не найден' }, { status: 400 })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
        password: hashedPassword,
        role,
        universityId: role === UserRole.UNIVERSITY_REP ? data.universityId : null,
        organization: role === UserRole.BUSINESS ? data.organization : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        universityId: true,
        organization: true,
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
    const { id, name, email, password, role, universityId, organization } = parsed.data

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name || null
    if (email) updateData.email = email.trim().toLowerCase()
    if (password) updateData.password = await bcrypt.hash(password, 10)

    // Проверка последнего админа, роли, вуза и организации — в одной транзакции
    // Serializable: иначе два параллельных запроса одновременно видят «остался один
    // админ» и оба проходят, либо PATCH с частью полей сбрасывает обязательную привязку.
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true, universityId: true, organization: true },
      })
      if (!target) {
        return { error: 'Пользователь не найден', status: 404 }
      }

      const nextRole = role ?? target.role
      const nextUniversityId = nextRole === UserRole.UNIVERSITY_REP
        ? (universityId !== undefined ? universityId || null : target.universityId)
        : null
      const nextOrganization = nextRole === UserRole.BUSINESS
        ? (organization !== undefined ? organization || null : target.organization)
        : null

      if (nextRole === UserRole.UNIVERSITY_REP && !nextUniversityId) {
        return { error: 'Для представителя вуза нужно выбрать вуз', status: 400 }
      }
      if (nextRole === UserRole.BUSINESS && !nextOrganization) {
        return { error: 'Для партнёра укажите организацию', status: 400 }
      }
      if (nextUniversityId) {
        const university = await tx.university.findUnique({
          where: { id: nextUniversityId },
          select: { id: true },
        })
        if (!university) {
          return { error: 'Университет не найден', status: 400 }
        }
      }

      if (role && role !== UserRole.ADMIN && target.role === UserRole.ADMIN) {
        const adminCount = await tx.user.count({ where: { role: UserRole.ADMIN } })
        if (adminCount <= 1) {
          return { error: 'Нельзя понизить роль последнего администратора', status: 400 }
        }
      }

      if (role) updateData.role = nextRole
      updateData.universityId = nextUniversityId
      updateData.organization = nextOrganization

      const user = await tx.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true, universityId: true, organization: true },
      })

      // Смена пароля отзывает все сессии пользователя: иначе старая cookie
      // продолжает работать и украденный пароль не даёт никакого эффекта.
      if (password) {
        await tx.session.deleteMany({ where: { userId: id } })
      }

      return { user }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await audit(currentUser, 'UPDATE', 'user', result.user.id, `${result.user.email} (${result.user.role})`)
    return NextResponse.json(result.user)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Email уже используется' }, { status: 409 })
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    if (error?.code === 'P2034') {
      return NextResponse.json({ error: 'Конфликт с параллельным запросом. Повторите попытку.' }, { status: 409 })
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

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { role: true } })
      if (!target) {
        return { error: 'Пользователь не найден', status: 404 }
      }

      if (target.role === UserRole.ADMIN) {
        const adminCount = await tx.user.count({ where: { role: UserRole.ADMIN } })
        if (adminCount <= 1) {
          return { error: 'Нельзя удалить последнего администратора — система останется без доступа к управлению', status: 400 }
        }
      }

      await tx.session.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })

      return { success: true }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await audit(user, 'DELETE', 'user', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2034') {
      return NextResponse.json({ error: 'Конфликт с параллельным запросом. Повторите попытку.' }, { status: 409 })
    }
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
