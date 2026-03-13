// src/app/api/sms-incoming/route.ts
// Receives SMS Gateway webhook (sms:received) and forwards to owner
import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/sms'

const FORWARD_TO = process.env.SMS_FORWARD_TO || '+16173197748'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate it's a received SMS event
    if (body.type !== 'sms:received' || !body.payload) {
      return NextResponse.json({ ok: true })
    }

    const { message, sender, phoneNumber, receivedAt, recipient } = body.payload
    const from = sender || phoneNumber || 'unknown'
    const time = receivedAt ? new Date(receivedAt).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''

    const text = `[SMS to ${recipient || 'SIM'}]\nFrom: ${from}${time ? `\n${time}` : ''}\n\n${message}`
    await sendSms(FORWARD_TO, text)

    console.log(`[SMS Forward] From ${from} → ${FORWARD_TO}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SMS Incoming Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
