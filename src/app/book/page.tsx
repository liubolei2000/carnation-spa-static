'use client'
import { useEffect } from 'react'

// Client-side redirect — compatible with `output: 'export'` (static build)
export default function BookPage() {
  useEffect(() => { window.location.replace('/?book=1') }, [])
  return null
}
