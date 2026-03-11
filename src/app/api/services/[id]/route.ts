// src/app/api/services/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const data = await req.json()
  if (data.price) data.price = Number(data.price)
  if (data.durationMin) data.durationMin = Number(data.durationMin)

  const service = await prisma.service.update({ where: { id }, data })
  return NextResponse.json(service)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const count = await prisma.appointment.count({ where: { serviceId: id } })
  if (count > 0)
    return NextResponse.json({ error: 'HAS_APPOINTMENTS', count }, { status: 409 })

  await prisma.service.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
