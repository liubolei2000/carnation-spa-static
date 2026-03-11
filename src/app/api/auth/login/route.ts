// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loginWithPhone, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json()
    if (!phone || !password)
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

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
