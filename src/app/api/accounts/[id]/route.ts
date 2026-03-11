// src/app/api/accounts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole, hashPassword } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  // 不允许修改自己的角色
  if (id === session!.accountId)
    return NextResponse.json({ error: 'CANNOT_EDIT_SELF' }, { status: 403 })

  const { name, password, role, isActive, therapistId } = await req.json()

  const data: any = {}
  if (name !== undefined)        data.name        = name
  if (role !== undefined)        data.role        = role
  if (isActive !== undefined)    data.isActive    = isActive
  if (therapistId !== undefined) data.therapistId = therapistId || null
  if (password)                  data.passwordHash = await hashPassword(password)

  const account = await prisma.account.update({
    where:  { id },
    data,
    select: { id: true, name: true, phone: true, role: true, isActive: true },
  })
  return NextResponse.json(account)
}
