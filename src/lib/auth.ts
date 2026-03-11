// src/lib/auth.ts
// JWT-based auth for staff accounts

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

const JWT_SECRET  = process.env.JWT_SECRET!
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d'
const COOKIE_NAME = 'carnation_session'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface SessionPayload {
  accountId:  string
  role:       Role
  name:       string
  therapistId: string | null
}

// ─────────────────────────────────────────
// Password
// ─────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─────────────────────────────────────────
// JWT
// ─────────────────────────────────────────

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions)
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload
  } catch {
    return null
  }
}

// ─────────────────────────────────────────
// Cookie session helpers (Server Components)
// ─────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function setSessionCookie(token: string) {
  // Called from API route after login
  return {
    name:     COOKIE_NAME,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     '/',
  }
}

export function clearSessionCookie() {
  return {
    name:    COOKIE_NAME,
    value:   '',
    maxAge:  0,
    path:    '/',
  }
}

// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────

export async function loginWithPhone(
  phone: string,
  password: string
): Promise<{ token: string; payload: SessionPayload } | null> {
  // Normalize phone: strip spaces, dashes, parens
  const normalized = phone.replace(/[\s\-\(\)]/g, '')
  const e164 = normalized.startsWith('+') ? normalized : `+1${normalized}`

  const account = await prisma.account.findUnique({
    where:  { phone: e164 },
    select: { id: true, passwordHash: true, role: true, name: true, therapistId: true, isActive: true },
  })

  if (!account || !account.isActive) return null

  const valid = await verifyPassword(password, account.passwordHash)
  if (!valid) return null

  const payload: SessionPayload = {
    accountId:   account.id,
    role:        account.role,
    name:        account.name,
    therapistId: account.therapistId,
  }

  return { token: signToken(payload), payload }
}

// ─────────────────────────────────────────
// Permission guards
// ─────────────────────────────────────────

export function requireRole(session: SessionPayload | null, ...roles: Role[]): boolean {
  if (!session) return false
  return roles.includes(session.role)
}

// Checks if user can manage a specific therapist's data
export function canAccessTherapist(session: SessionPayload, therapistId: string): boolean {
  if (session.role === Role.OWNER || session.role === Role.STAFF) return true
  if (session.role === Role.THERAPIST) return session.therapistId === therapistId
  return false
}
