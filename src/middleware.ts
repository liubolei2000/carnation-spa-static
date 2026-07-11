// src/middleware.ts
// 1. Adds CORS headers to /api/* so Cloudflare Pages frontend can call the tunnel API.
// 2. Protects /admin routes — redirects to /admin/login if not authenticated.
// NOTE: middleware runs in Edge runtime — cannot use jsonwebtoken (Node.js only).

import { NextRequest, NextResponse } from 'next/server'

// Allowed cross-origins: set CORS_ORIGIN=https://carnationspaburlington.com in .env.local
// Multiple origins can be comma-separated.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

function getCorsHeaders(origin: string): Record<string, string> {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    process.env.NODE_ENV !== 'production'
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Methods':     'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age':           '86400',
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get('origin') ?? ''

  // ── CORS preflight for API routes ────────────────────────────────────────
  if (pathname.startsWith('/api/') && req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    })
  }

  // ── CORS headers on all API responses ────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    const headers = getCorsHeaders(origin)
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v))
    return res
  }

  // ── Admin route protection ────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('carnation_session')?.value
    if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))

    const session = decodeJwtPayload(token)
    if (!session) return NextResponse.redirect(new URL('/admin/login', req.url))

    if (session.role === 'THERAPIST' && !pathname.startsWith('/admin/schedule')) {
      return NextResponse.redirect(new URL('/admin/schedule', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
