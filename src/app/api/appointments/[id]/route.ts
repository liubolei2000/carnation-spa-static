// src/app/api/appointments/[id]/route.ts
// 管理员用：查看单条、修改状态、取消
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'
import { sendCancellationNotice } from '@/lib/sms'
import { AppointmentStatus } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER', 'STAFF'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const appt = await prisma.appointment.findUnique({
    where:   { id },
    include: {
      service:   { select: { name: true, durationMin: true, price: true } },
      therapist: { select: { name: true } },
    },
  })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json(appt)
}

// PATCH — 更新状态（CONFIRMED / COMPLETED / NO_SHOW）
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!requireRole(session, 'OWNER', 'STAFF'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { status, notes } = await req.json()

  const validStatuses: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']
  if (status && !validStatuses.includes(status))
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })

  const appt = await prisma.appointment.findUnique({ where: { id } })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // 如果是取消，发短信通知
  if (status === 'CANCELLED' && appt.status !== 'CANCELLED') {
    const full = await prisma.appointment.findUnique({
      where:   { id },
      include: {
        service:   { select: { name: true } },
        therapist: { select: { name: true } },
      },
    })
    if (full) {
      await sendCancellationNotice({
        customerPhone: full.customerPhone,
        customerName:  full.customerName,
        serviceName:   full.service.name,
        therapistName: full.therapist.name,
        appointmentAt: full.appointmentAt,
        manageToken:   full.manageToken,
      })
    }
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data:  {
      ...(status ? { status } : {}),
      ...(notes  ? { notes }  : {}),
    },
    include: {
      service:   { select: { name: true, durationMin: true, price: true } },
      therapist: { select: { name: true } },
    },
  })

  return NextResponse.json(updated)
}
