// src/app/api/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole, hashPassword } from '@/lib/auth'
import { normalizePhone } from '@/lib/sms'

export async function GET() {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const accounts = await prisma.account.findMany({
    select: {
      id: true, name: true, phone: true, role: true,
      isActive: true, therapistId: true, createdAt: true,
      therapist: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { name, phone, password, role, therapistId } = await req.json()
  if (!name || !phone || !password || !role)
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  // 不允许创建 OWNER 角色
  if (role === 'OWNER')
    return NextResponse.json({ error: 'CANNOT_CREATE_OWNER' }, { status: 403 })

  let normalized: string
  try { normalized = normalizePhone(phone) }
  catch { return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 }) }

  const existing = await prisma.account.findUnique({ where: { phone: normalized } })
  if (existing) return NextResponse.json({ error: 'PHONE_TAKEN' }, { status: 409 })

  const hash = await hashPassword(password)
  const account = await prisma.account.create({
    data: {
      name, phone: normalized, passwordHash: hash,
      role, therapistId: therapistId || null,
      createdById: session!.accountId,
    },
    select: { id: true, name: true, phone: true, role: true, therapistId: true },
  })

  return NextResponse.json(account, { status: 201 })
}
