// src/app/api/sms/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationCode, normalizePhone } from '@/lib/sms'
import { SmsCodePurpose } from '@prisma/client'

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true  // skip in dev
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true  // not configured
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v1/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    if (!res.ok) {
      console.warn('[Turnstile] API returned', res.status, '— allowing request through')
      return true  // API unavailable, fall back to rate limiting only
    }
    const data = await res.json()
    return data.success === true
  } catch {
    console.warn('[Turnstile] API error — allowing request through')
    return true  // API unavailable, fall back to rate limiting only
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone, purpose, cfToken } = await req.json()
    if (!phone) return NextResponse.json({ error: 'MISSING_PHONE' }, { status: 400 })

    // Verify Turnstile (only enforced when secret key is configured)
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? ''
    const human = await verifyTurnstile(cfToken ?? '', ip)
    if (!human) return NextResponse.json({ error: 'BOT_DETECTED' }, { status: 403 })

    let normalized: string
    try { normalized = normalizePhone(phone) }
    catch { return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 }) }

    const result = await sendVerificationCode(
      normalized,
      (purpose as SmsCodePurpose) ?? SmsCodePurpose.BOOKING
    )

    if (!result.success) {
      const status = result.error === 'RATE_LIMITED' ? 429 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SMS Send Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
