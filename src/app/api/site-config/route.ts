// src/app/api/site-config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, requireRole } from '@/lib/auth'

// GET — 公开，返回所有配置 key/value
export async function GET() {
  const configs = await prisma.siteConfig.findMany()
  const result  = Object.fromEntries(configs.map(c => [c.key, c.value]))
  return NextResponse.json(result)
}

// PATCH — 仅 OWNER，批量更新
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

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
