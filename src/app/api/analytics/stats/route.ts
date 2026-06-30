// src/app/api/analytics/stats/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

  const [todayCount, weekCount, monthCount, topPages, daily] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pageView.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.pageView.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.pageView.groupBy({
      by: ['path'],
      _count: { path: true },
      where: { createdAt: { gte: weekStart } },
      orderBy: { _count: { path: 'desc' } },
      take: 5,
    }),
    // Last 7 days daily breakdown
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE("createdAt" AT TIME ZONE 'America/New_York') as day, COUNT(*)::int as count
      FROM "PageView"
      WHERE "createdAt" >= ${weekStart}
      GROUP BY day
      ORDER BY day ASC
    `,
  ])

  return NextResponse.json({
    today: todayCount,
    week:  weekCount,
    month: monthCount,
    topPages: topPages.map(p => ({ path: p.path, count: p._count.path })),
    daily: daily.map(d => ({ day: String(d.day), count: Number(d.count) })),
  })
}
