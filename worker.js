// worker.js
// Serves static assets for most requests.
// Proxies /api/* to the Pi server via Cloudflare Tunnel.

const PI_API = 'https://carnationspaburlington.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Proxy all /api/* requests to Pi
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, PI_API)
      const proxied = new Request(target, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      })
      return fetch(proxied)
    }

    // All other requests → serve static assets
    return env.ASSETS.fetch(request)
  }
}
