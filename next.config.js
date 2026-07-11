/** @type {import('next').NextConfig} */
// NEXT_EXPORT=1  → static export for Cloudflare Pages
// (default)      → standalone for Termux/server
const isExport = process.env.NEXT_EXPORT === '1'

const nextConfig = {
  output: isExport ? 'export' : 'standalone',
  trailingSlash: isExport,
  images: {
    remotePatterns: [],
    unoptimized: isExport,
  },
  devIndicators: false,
}

module.exports = nextConfig
