// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAppointmentSafe } from '@/lib/availability'
import { sendBookingConfirmation, normalizePhone, verifyCode } from '@/lib/sms'
import { getSession, requireRole } from '@/lib/auth'
import { SmsCodePurpose } from '@prisma/client'

// GET — list appointments
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status')
  const therapistId = searchParams.get('therapistId')
  const date        = searchParams.get('date')
  const from        = searchParams.get('from')  // show appointments on/after this date

  const where: any = {}
  if (status)      where.status      = status
  if (therapistId) where.therapistId = therapistId
  if (date) {
    const d = new Date(date + 'T00:00:00')
    where.appointmentAt = {
      gte: new Date(d.setHours(0,0,0,0)),
      lte: new Date(new Date(date + 'T00:00:00').setHours(23,59,59,999)),
    }
  } else if (from) {
    where.appointmentAt = { gte: new Date(from + 'T00:00:00') }
  }

  // Therapists can only see their own appointments
  if (session.role === 'THERAPIST') {
    where.therapistId = session.therapistId
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      service:   { select: { name: true, durationMin: true, price: true } },
      therapist: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { appointmentAt: 'asc' },
  })

  return NextResponse.json(appointments)
}

// POST — create appointment (online needs SMS code; manual needs staff login)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { serviceId, therapistId, customerName, customerPhone,
            date, time, notes, source, smsCode } = body

    if (!serviceId || !therapistId || !customerName || !customerPhone || !date || !time)
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

    let phone: string
    try { phone = normalizePhone(customerPhone) }
    catch { return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 }) }

    const isOnline = !source || source === 'ONLINE'

    if (isOnline) {
      if (!smsCode) return NextResponse.json({ error: 'SMS_CODE_REQUIRED' }, { status: 400 })
      const codeResult = await verifyCode(phone, smsCode, SmsCodePurpose.BOOKING)
      if (!codeResult.valid)
        return NextResponse.json({ error: codeResult.error }, { status: 400 })
    } else {
      const session = await getSession()
      if (!requireRole(session, 'OWNER', 'STAFF'))
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const service = await prisma.service.findUnique({
      where:  { id: serviceId },
      select: { durationMin: true, name: true },
    })
    if (!service) return NextResponse.json({ error: 'SERVICE_NOT_FOUND' }, { status: 404 })

    const appointmentAt = new Date(`${date}T${time}:00`)
    const session = await getSession()
    const appt = await createAppointmentSafe({
      serviceId, therapistId,
      customerName,
      customerPhone: phone,
      appointmentAt,
      durationMins:  service.durationMin,
      notes,
      source:        isOnline ? 'ONLINE' : 'MANUAL',
      createdById:   session?.accountId,
    })

    await sendBookingConfirmation({
      customerPhone: phone,
      customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })

    return NextResponse.json({ ok: true, id: appt.id, token: appt.manageToken }, { status: 201 })

  } catch (err: any) {
    const msg = err?.message ?? ''
    if (msg === 'TIME_SLOT_TAKEN')        return NextResponse.json({ error: msg }, { status: 409 })
    if (msg === 'OUTSIDE_BUSINESS_HOURS') return NextResponse.json({ error: msg }, { status: 422 })
    if (msg === 'THERAPIST_UNAVAILABLE')  return NextResponse.json({ error: msg }, { status: 422 })
    console.error('[Booking Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
