// src/app/api/sms/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyCode, normalizePhone } from '@/lib/sms'
import { SmsCodePurpose } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const { phone, code, purpose } = await req.json()
    if (!phone || !code) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

    const normalized = normalizePhone(phone)
    const result = await verifyCode(
      normalized, code,
      (purpose as SmsCodePurpose) ?? SmsCodePurpose.BOOKING
    )

    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SMS Verify Error]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
