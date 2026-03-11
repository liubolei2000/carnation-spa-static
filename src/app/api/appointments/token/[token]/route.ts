// src/app/api/appointments/token/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rescheduleAppointment } from '@/lib/availability'
import { sendCancellationNotice, sendRescheduleConfirmation } from '@/lib/sms'

type Params = { params: Promise<{ token: string }> }

const include = {
  service:   { select: { id: true, name: true, durationMin: true, price: true } },
  therapist: { select: { name: true, title: true } },
}

export async function GET(_: NextRequest, { params }: Params) {
  const { token } = await params
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token }, include })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (appt.tokenExpiresAt < new Date())
    return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 410 })
  const masked = { ...appt, customerPhone: appt.customerPhone.replace(/(\+\d{1,2})\d+(\d{4})$/, '$1****$2') }
  return NextResponse.json(masked)
}

// Unified PATCH: cancel or reschedule
export async function PATCH(req: NextRequest, { params }: Params) {
  const { token } = await params
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token }, include })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (appt.tokenExpiresAt < new Date())
    return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 410 })
  if (appt.status === 'CANCELLED')
    return NextResponse.json({ error: 'ALREADY_CANCELLED' }, { status: 400 })

  const body = await req.json()
  const action = body.action ?? 'reschedule'

  if (action === 'cancel') {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED' } })
    await sendCancellationNotice({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })
    return NextResponse.json({ ok: true })
  }

  // reschedule
  const { date, time, therapistId } = body
  if (!date || !time) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const newStart = new Date(`${date}T${time}:00`)

  try {
    // If therapist changed, update that too
    if (therapistId && therapistId !== appt.therapistId) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { therapistId } })
    }
    await rescheduleAppointment(appt.id, newStart, appt.service.durationMin)
    const updated = await prisma.appointment.findUnique({ where: { id: appt.id }, include })
    await sendRescheduleConfirmation({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: updated!.therapist.name,
      appointmentAt: updated!.appointmentAt,
      manageToken:   appt.manageToken,
    })
    const masked = { ...updated!, customerPhone: appt.customerPhone.replace(/(\+\d{1,2})\d+(\d{4})$/, '$1****$2') }
    return NextResponse.json(masked)
  } catch (err: any) {
    if (err.message === 'TIME_SLOT_TAKEN')
      return NextResponse.json({ error: 'TIME_SLOT_TAKEN' }, { status: 409 })
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
