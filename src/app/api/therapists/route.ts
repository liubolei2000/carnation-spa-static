// src/app/api/therapists/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get('all')
  const session = await getSession()
  const isAdmin = session && (session.role === 'OWNER' || session.role === 'STAFF')

  const therapists = await prisma.therapist.findMany({
    where:   (all && isAdmin) ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true, title: true, bio: true, avatarUrl: true, googleReviewUrl: true, bufferMins: true, isActive: true, sortOrder: true },
  })
  return NextResponse.json(therapists)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { name, title, bio, googleReviewUrl, avatarUrl, bufferMins, sortOrder } = await req.json()
  if (!name) return NextResponse.json({ error: 'MISSING_NAME' }, { status: 400 })

  const count = await prisma.therapist.count()
  const therapist = await prisma.therapist.create({
    data: { name, title, bio, googleReviewUrl, avatarUrl, bufferMins: bufferMins ?? 15, sortOrder: sortOrder ?? count },
  })
  return NextResponse.json(therapist, { status: 201 })
}
