// src/app/api/therapists/[id]/hours/route.ts
// GET  — return work hours for a therapist (7 days, with defaults)
// PUT  — upsert all 7 days of work hours

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

const DEFAULT_OPEN  = '09:00'
const DEFAULT_CLOSE = '21:00'

// Returns a full 7-day schedule, filling missing days with defaults
function buildFullWeek(saved: { dayOfWeek: number; isWorkday: boolean; openTime: string; closeTime: string }[]) {
  return Array.from({ length: 7 }, (_, dow) => {
    const found = saved.find(r => r.dayOfWeek === dow)
    return {
      dayOfWeek: dow,
      isWorkday: found ? found.isWorkday : true,
      openTime:  found ? found.openTime  : DEFAULT_OPEN,
      closeTime: found ? found.closeTime : DEFAULT_CLOSE,
    }
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const saved = await prisma.therapistWorkHours.findMany({
    where: { therapistId: id },
    select: { dayOfWeek: true, isWorkday: true, openTime: true, closeTime: true },
  })

  return NextResponse.json(buildFullWeek(saved))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER', 'STAFF'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { id } = await params
  const body: { dayOfWeek: number; isWorkday: boolean; openTime: string; closeTime: string }[] = await req.json()

  if (!Array.isArray(body) || body.length !== 7) {
    return NextResponse.json({ error: 'Expected array of 7 days' }, { status: 400 })
  }

  // Validate time format HH:MM
  const timeRe = /^\d{2}:\d{2}$/
  for (const day of body) {
    if (!timeRe.test(day.openTime) || !timeRe.test(day.closeTime)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
    }
  }

  // Upsert all 7 days in a transaction
  await prisma.$transaction(
    body.map(day =>
      prisma.therapistWorkHours.upsert({
        where:  { therapistId_dayOfWeek: { therapistId: id, dayOfWeek: day.dayOfWeek } },
        update: { isWorkday: day.isWorkday, openTime: day.openTime, closeTime: day.closeTime },
        create: { therapistId: id, dayOfWeek: day.dayOfWeek, isWorkday: day.isWorkday, openTime: day.openTime, closeTime: day.closeTime },
      })
    )
  )

  const saved = await prisma.therapistWorkHours.findMany({
    where: { therapistId: id },
    select: { dayOfWeek: true, isWorkday: true, openTime: true, closeTime: true },
  })

  return NextResponse.json(buildFullWeek(saved))
}
