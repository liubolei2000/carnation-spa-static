// prisma/download-service-images.ts
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import https from 'https'
import http from 'http'

const prisma = new PrismaClient()

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(dest)
    const get = url.startsWith('https') ? https.get : http.get
    get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        const loc = res.headers.location!
        const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
        download(nextUrl, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', (err) => { file.close(); reject(err) })
  })
}

const items = [
  { name: 'Deep Tissue Massage Therapy',   keywords: 'deep,tissue,massage,back',      lock: 1 },
  { name: 'Prenatal Massage Therapy',       keywords: 'prenatal,pregnancy,massage',    lock: 2 },
  { name: 'Massage Therapy 90 min',         keywords: 'massage,therapy,relaxation',    lock: 3 },
  { name: 'Swedish Massage Therapy',        keywords: 'swedish,massage,spa',           lock: 4 },
  { name: 'Facial Care',                    keywords: 'facial,skincare,beauty,spa',    lock: 5 },
  { name: 'Head Therapy',                   keywords: 'head,scalp,massage,hair',       lock: 6 },
  { name: 'Foot Massage Therapy 60 min',    keywords: 'foot,reflexology,massage',      lock: 7 },
  { name: 'Foot Massage Therapy 30 min',    keywords: 'foot,massage,wellness',         lock: 8 },
  { name: 'Combo',                          keywords: 'spa,wellness,massage,relax',    lock: 9 },
  { name: 'Cupping',                        keywords: 'cupping,therapy,traditional',   lock: 10 },
  { name: 'Hot Stone (Add-on)',             keywords: 'hot,stone,massage,basalt',      lock: 11 },
  { name: 'Package — 5 Sessions',          keywords: 'spa,luxury,wellness,calm',      lock: 12 },
  { name: 'Package — 10 Sessions',         keywords: 'wellness,health,spa,relax',     lock: 13 },
]

async function main() {
  const uploadDir = join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })

  for (const item of items) {
    const filename = `svc-${item.lock}-${item.keywords.split(',')[0].replace(/\s/g,'-')}.jpg`
    const filepath = join(uploadDir, filename)
    const publicUrl = `/uploads/${filename}`
    const downloadUrl = `https://loremflickr.com/800/500/${item.keywords}?lock=${item.lock}`

    process.stdout.write(`  Downloading: ${item.name}… `)
    try {
      await download(downloadUrl, filepath)
      const svc = await prisma.service.findFirst({ where: { name: item.name } })
      if (svc) {
        await prisma.service.update({ where: { id: svc.id }, data: { imageUrl: publicUrl } })
        console.log(`✓  ${publicUrl}`)
      } else {
        console.log(`✗  service not found in DB`)
      }
    } catch (e) {
      console.log(`✗  ${(e as Error).message}`)
    }
  }

  console.log('\nAll done!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
