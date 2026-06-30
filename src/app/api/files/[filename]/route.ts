// src/app/api/files/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  // prevent path traversal
  if (filename.includes('..') || filename.includes('/'))
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mime = MIME[ext]
  if (!mime) return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })

  try {
    const buf = await readFile(join(process.cwd(), 'public', 'uploads', filename))
    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
}
