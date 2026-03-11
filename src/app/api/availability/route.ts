// src/app/api/availability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAllTherapistsAvailability } from '@/lib/availability'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr   = searchParams.get('date')      // "2025-03-07"
  const serviceId = searchParams.get('serviceId')

  if (!dateStr || !serviceId)
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })

  const service = await prisma.service.findUnique({
    where:  { id: serviceId },
    select: { durationMin: true },
  })
  if (!service) return NextResponse.json({ error: 'SERVICE_NOT_FOUND' }, { status: 404 })

  // Parse date as local midnight
  const date = new Date(dateStr + 'T00:00:00')
  const results = await getAllTherapistsAvailability(date, service.durationMin)
  return NextResponse.json(results)
}
