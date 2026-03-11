// src/app/api/cron/remind/route.ts
// 每小时由 vercel.json cron 触发，或本地用 crontab
// 发送 24h 和 2h 提醒短信
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReminder24h, sendReminder2h } from '@/lib/sms'

export async function GET(req: NextRequest) {
  // 验证 cron 密钥
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const now = new Date()

  // ── 24h 提醒：24–25小时后的预约 ──
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60_000)

  const due24h = await prisma.appointment.findMany({
    where: {
      status:        { in: ['PENDING', 'CONFIRMED'] },
      reminded24h:   false,
      appointmentAt: { gte: in24h, lte: in25h },
    },
    include: {
      service:   { select: { name: true } },
      therapist: { select: { name: true } },
    },
  })

  for (const appt of due24h) {
    await sendReminder24h({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })
    await prisma.appointment.update({
      where: { id: appt.id },
      data:  { reminded24h: true },
    })
  }

  // ── 2h 提醒：2–3小时后的预约 ──
  const in2h = new Date(now.getTime() + 2 * 60 * 60_000)
  const in3h = new Date(now.getTime() + 3 * 60 * 60_000)

  const due2h = await prisma.appointment.findMany({
    where: {
      status:        { in: ['PENDING', 'CONFIRMED'] },
      reminded2h:    false,
      appointmentAt: { gte: in2h, lte: in3h },
    },
    include: {
      service:   { select: { name: true } },
      therapist: { select: { name: true } },
    },
  })

  for (const appt of due2h) {
    await sendReminder2h({
      customerPhone: appt.customerPhone,
      customerName:  appt.customerName,
      serviceName:   appt.service.name,
      therapistName: appt.therapist.name,
      appointmentAt: appt.appointmentAt,
      manageToken:   appt.manageToken,
    })
    await prisma.appointment.update({
      where: { id: appt.id },
      data:  { reminded2h: true },
    })
  }

  console.log(`[Cron] 24h reminders: ${due24h.length}  2h reminders: ${due2h.length}`)

  return NextResponse.json({
    ok:          true,
    reminded24h: due24h.length,
    reminded2h:  due2h.length,
    ranAt:       now.toISOString(),
  })
}
