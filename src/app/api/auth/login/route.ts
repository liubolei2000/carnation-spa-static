// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loginWithPhone, setSessionCookie } from '@/lib/auth'

// ── IP rate limiting (in-memory) ─────────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

// ── Turnstile verification ────────────────────────────────
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true  // not configured — skip
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? 'unknown'

    if (!checkRateLimit(ip))
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })

    const { phone, password, cfToken } = await req.json()
    if (!phone || !password)
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

    // Verify CAPTCHA if Turnstile is configured
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!cfToken) return NextResponse.json({ error: 'CAPTCHA_REQUIRED' }, { status: 400 })
      const ok = await verifyTurnstile(cfToken, ip)
      if (!ok) return NextResponse.json({ error: 'CAPTCHA_FAILED' }, { status: 400 })
    }

    const result = await loginWithPhone(phone, password)
    if (!result)
      return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })

    const res = NextResponse.json({
      ok:   true,
      role: result.payload.role,
      name: result.payload.name,
    })
    res.cookies.set(setSessionCookie(result.token))
    return res
  } catch (err) {
    console.error('[Login Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
