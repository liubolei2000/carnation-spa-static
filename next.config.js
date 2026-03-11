/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // 生成独立可部署包（Docker / Pi 使用）
  images: {
    remotePatterns: [],
  },
  devIndicators: false,
}

module.exports = nextConfig
