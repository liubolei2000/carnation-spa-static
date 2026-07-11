// scripts/build-pages.js
// Builds the static export for Cloudflare Pages.
// Temporarily moves src/app/api out of the build tree (API runs on local server
// via Cloudflare Tunnel, not on CF Pages), then restores it afterwards.
// Cross-platform: works on Windows (local dev) and Linux (CF Pages CI).

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root   = path.join(__dirname, '..')
const apiDir = path.join(root, 'src/app/api')
const apiBak = path.join(root, 'src/app/_api_bak')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d)
  }
}

// Move api directory out of Next.js build tree
copyDir(apiDir, apiBak)
fs.rmSync(apiDir, { recursive: true, force: true })
console.log('→ Moved src/app/api out of build tree')

let exitCode = 0
try {
  execSync('npx next build', {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NEXT_EXPORT: '1' },
  })
} catch (e) {
  exitCode = typeof e.status === 'number' ? e.status : 1
}

// Always restore api directory
copyDir(apiBak, apiDir)
fs.rmSync(apiBak, { recursive: true, force: true })
console.log('→ Restored src/app/api')

// Remove admin panel from static output (served via Tunnel, not CF Pages)
try {
  fs.rmSync(path.join(root, 'out/admin'), { recursive: true, force: true })
  console.log('→ Removed out/admin from static output')
} catch {}

process.exit(exitCode)
