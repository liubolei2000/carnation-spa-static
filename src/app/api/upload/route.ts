// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireRole } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!requireRole(session, 'OWNER'))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${randomUUID()}.${ext}`
  const uploadDir = join(process.cwd(), 'public', 'uploads')

  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(join(uploadDir, filename), Buffer.from(bytes))

  return NextResponse.json({ url: `/api/files/${filename}` })
}
