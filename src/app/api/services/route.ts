// src/app/api/services/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get('all')
  const session = await getSession()
  const isAdmin = session && (session.role === 'OWNER' || session.role === 'STAFF')

  const services = await prisma.service.findMany({
    where:   (all && isAdmin) ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(services)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { name, description, durationMin, price, imageUrl, sortOrder } = await req.json()
  if (!name || !durationMin || !price)
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const service = await prisma.service.create({
    data: { name, description, durationMin: Number(durationMin), price: Number(price), imageUrl, sortOrder: sortOrder ?? 0 },
  })
  return NextResponse.json(service, { status: 201 })
}
