// src/middleware.ts
// Protects /admin routes — redirects to /admin/login if not authenticated
// NOTE: middleware runs in Edge runtime — cannot use jsonwebtoken (Node.js only).
// We decode the JWT payload without signature verification here; full verification
// happens in every API route via getSession() / verifyToken().

import { NextRequest, NextResponse } from 'next/server'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json)
    // Basic expiry check
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /admin routes (not /admin/login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('carnation_session')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }

    const session = decodeJwtPayload(token)
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }

    // Therapists can only access their own schedule page
    if (
      session.role === 'THERAPIST' &&
      !pathname.startsWith('/admin/schedule')
    ) {
      return NextResponse.redirect(new URL('/admin/schedule', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
