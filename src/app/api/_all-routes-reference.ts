// ═══════════════════════════════════════════════════════════════
// API ROUTES — Carnation Spa
// All routes in one reference file.
// In your project, split each section into its own route.ts file
// as shown by the path comment at the top of each section.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/auth/login/route.ts
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { loginWithPhone, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { phone, password } = await req.json()
  if (!phone || !password) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const result = await loginWithPhone(phone, password)
  if (!result) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, role: result.payload.role, name: result.payload.name })
  const cookie = setSessionCookie(result.token)
  res.cookies.set(cookie)
  return res
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/auth/logout/route.ts
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
/*
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(clearSessionCookie())
  return res
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/auth/me/route.ts
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────
/*
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json(session)
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/sms/send/route.ts
// POST /api/sms/send — send verification code
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationCode, normalizePhone } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const { phone, purpose } = await req.json()
  if (!phone) return NextResponse.json({ error: 'MISSING_PHONE' }, { status: 400 })

  let normalized: string
  try { normalized = normalizePhone(phone) }
  catch { return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 }) }

  const result = await sendVerificationCode(normalized, purpose ?? 'BOOKING')
  if (!result.success) {
    const status = result.error === 'RATE_LIMITED' ? 429 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/sms/verify/route.ts
// POST /api/sms/verify — verify code
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { verifyCode, normalizePhone } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const { phone, code, purpose } = await req.json()
  if (!phone || !code) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const normalized = normalizePhone(phone)
  const result = await verifyCode(normalized, code, purpose ?? 'BOOKING')

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/availability/route.ts
// GET /api/availability?date=2025-03-07&serviceId=xxx
// Returns available slots for all therapists
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { getAllTherapistsAvailability } from '@/lib/availability'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr   = searchParams.get('date')      // "2025-03-07"
  const serviceId = searchParams.get('serviceId')

  if (!dateStr || !serviceId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const service = await prisma.service.findUnique({
    where:  { id: serviceId },
    select: { durationMin: true },
  })
  if (!service) return NextResponse.json({ error: 'SERVICE_NOT_FOUND' }, { status: 404 })

  const date = new Date(dateStr + 'T00:00:00')
  const results = await getAllTherapistsAvailability(date, service.durationMin)

  return NextResponse.json(results)
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/appointments/route.ts
// GET  /api/appointments  — list (admin)
// POST /api/appointments  — create booking
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAppointmentSafe } from '@/lib/availability'
import { sendBookingConfirmation, normalizePhone } from '@/lib/sms'
import { getSession, requireRole } from '@/lib/auth'
import { verifyCode } from '@/lib/sms'

// GET — list all appointments (OWNER/STAFF only)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER', 'STAFF')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status')
  const therapistId = searchParams.get('therapistId')
  const date        = searchParams.get('date')

  const where: any = {}
  if (status)      where.status      = status
  if (therapistId) where.therapistId = therapistId
  if (date) {
    const d = new Date(date)
    const start = new Date(d); start.setHours(0,0,0,0)
    const end   = new Date(d); end.setHours(23,59,59,999)
    where.appointmentAt = { gte: start, lte: end }
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

// POST — create booking (public for online, auth for manual)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    serviceId, therapistId, customerName, customerPhone,
    date, time, notes, source, smsCode,
  } = body

  if (!serviceId || !therapistId || !customerName || !customerPhone || !date || !time) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  let phone: string
  try { phone = normalizePhone(customerPhone) }
  catch { return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 }) }

  // Online bookings require SMS verification
  if (!source || source === 'ONLINE') {
    if (!smsCode) return NextResponse.json({ error: 'SMS_CODE_REQUIRED' }, { status: 400 })
    const codeResult = await verifyCode(phone, smsCode, 'BOOKING')
    if (!codeResult.valid) {
      return NextResponse.json({ error: codeResult.error }, { status: 400 })
    }
  } else {
    // Manual bookings require staff auth
    const session = await getSession()
    if (!requireRole(session, 'OWNER', 'STAFF')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // Get service duration
  const service = await prisma.service.findUnique({
    where:  { id: serviceId },
    select: { durationMin: true, name: true },
  })
  if (!service) return NextResponse.json({ error: 'SERVICE_NOT_FOUND' }, { status: 404 })

  // Parse datetime (timezone: America/New_York stored as UTC)
  const appointmentAt = new Date(`${date}T${time}:00`)

  try {
    const session = await getSession()
    const appt = await createAppointmentSafe({
      serviceId, therapistId, customerName,
      customerPhone: phone,
      appointmentAt,
      durationMins:  service.durationMin,
      notes,
      source:        source ?? 'ONLINE',
      createdById:   session?.accountId,
    })

    // Send confirmation SMS
    await sendBookingConfirmation({
      customerPhone: phone,
      customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })

    return NextResponse.json({
      ok:    true,
      id:    appt.id,
      token: appt.manageToken,
    }, { status: 201 })

  } catch (err: any) {
    const msg = err.message
    if (msg === 'TIME_SLOT_TAKEN')         return NextResponse.json({ error: msg }, { status: 409 })
    if (msg === 'OUTSIDE_BUSINESS_HOURS')  return NextResponse.json({ error: msg }, { status: 422 })
    if (msg === 'THERAPIST_UNAVAILABLE')   return NextResponse.json({ error: msg }, { status: 422 })
    console.error('[Booking Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/appointments/[token]/route.ts
// GET    /api/appointments/[token] — customer self-manage
// PATCH  /api/appointments/[token] — reschedule
// DELETE /api/appointments/[token] — cancel
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rescheduleAppointment } from '@/lib/availability'
import { sendCancellationNotice } from '@/lib/sms'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const appt = await prisma.appointment.findUnique({
    where:   { manageToken: params.token },
    include: {
      service:   { select: { name: true, durationMin: true, price: true } },
      therapist: { select: { name: true } },
    },
  })

  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (appt.tokenExpiresAt < new Date()) {
    return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 410 })
  }

  // Mask phone for privacy
  const masked = appt.customerPhone.replace(/(\+\d{1,2})(\d+)(\d{4})/, '$1****$3')
  return NextResponse.json({ ...appt, customerPhone: masked })
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const appt = await prisma.appointment.findUnique({ where: { manageToken: params.token } })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (appt.tokenExpiresAt < new Date()) return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 410 })
  if (appt.status === 'CANCELLED') return NextResponse.json({ error: 'ALREADY_CANCELLED' }, { status: 400 })

  const { date, time } = await req.json()
  const service = await prisma.service.findUnique({ where: { id: appt.serviceId }, select: { durationMin: true } })
  const newStart = new Date(`${date}T${time}:00`)

  try {
    await rescheduleAppointment(appt.id, newStart, service!.durationMin)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.message === 'TIME_SLOT_TAKEN') return NextResponse.json({ error: 'TIME_SLOT_TAKEN' }, { status: 409 })
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { token: string } }) {
  const appt = await prisma.appointment.findUnique({
    where:   { manageToken: params.token },
    include: { service: { select: { name: true } }, therapist: { select: { name: true } } },
  })
  if (!appt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (appt.tokenExpiresAt < new Date()) return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 410 })
  if (appt.status === 'CANCELLED') return NextResponse.json({ error: 'ALREADY_CANCELLED' }, { status: 400 })

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
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/services/route.ts
// GET  /api/services     — public list
// POST /api/services     — create (OWNER only)
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function GET() {
  const services = await prisma.service.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(services)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const data = await req.json()
  const service = await prisma.service.create({ data })
  return NextResponse.json(service, { status: 201 })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/services/[id]/route.ts
// PATCH  /api/services/[id]  — update
// DELETE /api/services/[id]  — deactivate
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const data = await req.json()
  const service = await prisma.service.update({ where: { id: params.id }, data })
  return NextResponse.json(service)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  // Soft delete: just deactivate
  await prisma.service.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/therapists/route.ts
// GET  — public list
// POST — create (OWNER only)
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function GET() {
  const therapists = await prisma.therapist.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true, title: true, bio: true, avatarUrl: true, googleReviewUrl: true },
  })
  return NextResponse.json(therapists)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const data = await req.json()
  const therapist = await prisma.therapist.create({ data })
  return NextResponse.json(therapist, { status: 201 })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/therapists/[id]/schedule/route.ts
// GET /api/therapists/[id]/schedule?date=2025-03-07&serviceId=xxx
// Returns slots for one therapist (used in booking drawer + admin day view)
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/availability'
import { prisma } from '@/lib/prisma'
import { getSession, canAccessTherapist } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()

  // Therapists can only see their own schedule
  if (session && !canAccessTherapist(session, params.id)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateStr   = searchParams.get('date')
  const serviceId = searchParams.get('serviceId')

  if (!dateStr || !serviceId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { durationMin: true } })
  if (!service) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const date  = new Date(dateStr + 'T00:00:00')
  const slots = await getAvailableSlots(params.id, date, service.durationMin)

  return NextResponse.json(slots)
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/accounts/route.ts
// GET  — list accounts (OWNER only)
// POST — create account (OWNER only)
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole, hashPassword } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const accounts = await prisma.account.findMany({
    select: { id: true, name: true, phone: true, role: true, isActive: true, therapistId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { name, phone, password, role, therapistId } = await req.json()
  if (!name || !phone || !password || !role) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  // Prevent creating another OWNER
  if (role === 'OWNER') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const hash = await hashPassword(password)
  const account = await prisma.account.create({
    data: { name, phone, passwordHash: hash, role, therapistId, createdById: session!.accountId },
  })

  return NextResponse.json({ id: account.id, name: account.name, role: account.role }, { status: 201 })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/site-config/route.ts
// GET   — public, returns all config
// PATCH — OWNER only, update keys
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function GET() {
  const configs = await prisma.siteConfig.findMany()
  const result = Object.fromEntries(configs.map(c => [c.key, c.value]))
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const updates: Record<string, string> = await req.json()

  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      prisma.siteConfig.upsert({
        where:  { key },
        update: { value },
        create: { key, value, type: 'TEXT' },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
*/

// ─────────────────────────────────────────────────────────────
// FILE: src/app/api/cron/remind/route.ts
// GET /api/cron/remind
// Called by Vercel Cron every hour
// Sends 24h and 2h reminder SMS messages
// ─────────────────────────────────────────────────────────────
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReminder24h, sendReminder2h } from '@/lib/sms'

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const now = new Date()

  // ── 24-hour reminders ──
  const in24h     = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h     = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const upcoming24h = await prisma.appointment.findMany({
    where: {
      status:       { in: ['PENDING', 'CONFIRMED'] },
      reminded24h:  false,
      appointmentAt: { gte: in24h, lte: in25h },
    },
    include: {
      service:   { select: { name: true } },
      therapist: { select: { name: true } },
    },
  })

  for (const appt of upcoming24h) {
    await sendReminder24h({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminded24h: true } })
  }

  // ── 2-hour reminders ──
  const in2h  = new Date(now.getTime() + 2  * 60 * 60 * 1000)
  const in3h  = new Date(now.getTime() + 3  * 60 * 60 * 1000)

  const upcoming2h = await prisma.appointment.findMany({
    where: {
      status:       { in: ['PENDING', 'CONFIRMED'] },
      reminded2h:   false,
      appointmentAt: { gte: in2h, lte: in3h },
    },
    include: {
      service:   { select: { name: true } },
      therapist: { select: { name: true } },
    },
  })

  for (const appt of upcoming2h) {
    await sendReminder2h({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminded2h: true } })
  }

  console.log(`[Cron] Sent ${upcoming24h.length} 24h reminders, ${upcoming2h.length} 2h reminders`)

  return NextResponse.json({
    ok:           true,
    reminded24h:  upcoming24h.length,
    reminded2h:   upcoming2h.length,
  })
}
*/

export {}  // make this a module
