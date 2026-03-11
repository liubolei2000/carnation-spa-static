// src/app/api/therapists/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const data = await req.json()
  const therapist = await prisma.therapist.update({ where: { id }, data })
  return NextResponse.json(therapist)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const count = await prisma.appointment.count({ where: { therapistId: id } })
  if (count > 0)
    return NextResponse.json({ error: 'HAS_APPOINTMENTS', count }, { status: 409 })

  await prisma.therapist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
