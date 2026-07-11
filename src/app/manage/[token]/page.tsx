// Server Component wrapper — required for `output: 'export'`.
// `generateStaticParams` cannot coexist with 'use client' in the same file.
// CF Pages serves this shell for any /manage/<token> URL via _redirects rewrite.
import ManagePage from './ManagePage'

export function generateStaticParams() {
  return [{ token: '_' }]
}

export default function Page() {
  return <ManagePage />
}
