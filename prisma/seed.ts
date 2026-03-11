// ═══════════════════════════════════════════════════
// prisma/seed.ts
// Run: npx prisma db seed
// Creates: owner account, services, therapists, site config
// ═══════════════════════════════════════════════════

import { PrismaClient, Role, SiteConfigType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌸 Seeding Carnation Spa database...\n')

  // ─────────────────────────────────────────
  // 1. OWNER ACCOUNT (from environment variables)
  // ─────────────────────────────────────────
  const ownerPhone    = process.env.ADMIN_PHONE    ?? '+19783300895'
  const ownerPassword = process.env.ADMIN_PASSWORD ?? 'changeme123'
  const ownerName     = process.env.ADMIN_NAME     ?? 'Admin'

  const existingOwner = await prisma.account.findFirst({ where: { role: Role.OWNER } })

  if (!existingOwner) {
    const hash = await bcrypt.hash(ownerPassword, 12)
    await prisma.account.create({
      data: {
        phone:        ownerPhone,
        passwordHash: hash,
        name:         ownerName,
        role:         Role.OWNER,
      }
    })
    console.log(`✅ Owner account created: ${ownerPhone}`)
  } else {
    console.log('⏭️  Owner account already exists, skipping.')
  }

  // ─────────────────────────────────────────
  // 2. SERVICES
  // ─────────────────────────────────────────
  const services = [
    {
      name: 'Classic Full Body',
      description: 'Traditional techniques to ease muscle tension, improve circulation, and restore full-body vitality.',
      durationMin: 60,
      price: 42.00,
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'Deep Tissue Therapy',
      description: 'Targets deep muscle layers to relieve chronic pain, sports injuries, and long-term postural issues.',
      durationMin: 90,
      price: 65.00,
      isActive: true,
      sortOrder: 2,
    },
    {
      name: 'Aromatherapy Oil',
      description: 'Natural essential oils with gentle flowing strokes to calm the nervous system and nourish the skin.',
      durationMin: 75,
      price: 55.00,
      isActive: true,
      sortOrder: 3,
    },
    {
      name: 'Hot Stone Healing',
      description: 'Basalt hot stones combined with massage for deep heat penetration and profound muscle relief.',
      durationMin: 90,
      price: 75.00,
      isActive: true,
      sortOrder: 4,
    },
  ]

  for (const svc of services) {
    const existing = await prisma.service.findFirst({ where: { name: svc.name } })
    if (!existing) {
      await prisma.service.create({ data: svc })
      console.log(`✅ Service created: ${svc.name}`)
    } else {
      console.log(`⏭️  Service already exists: ${svc.name}`)
    }
  }

  // ─────────────────────────────────────────
  // 3. THERAPISTS
  // ─────────────────────────────────────────
  const therapists = [
    {
      name:       'Mei Lin',
      title:      'Lead Therapist · 8 yrs',
      bio:        'Specializing in deep tissue and hot stone therapy, Mei brings a meditative presence to every session.',
      bufferMins: 15,
      isActive:   true,
      sortOrder:  1,
    },
    {
      name:       'Sarah Chen',
      title:      'Aromatherapy Specialist · 5 yrs',
      bio:        "Sarah's aromatherapy blends are custom-crafted for each client, creating a uniquely personal experience.",
      bufferMins: 15,
      isActive:   true,
      sortOrder:  2,
    },
    {
      name:       'David Park',
      title:      'Sports Therapy · 6 yrs',
      bio:        'A former athlete, David understands the body\'s mechanics and excels in rehabilitative and sports massage.',
      bufferMins: 15,
      isActive:   true,
      sortOrder:  3,
    },
  ]

  const createdTherapists: Record<string, string> = {}

  for (const t of therapists) {
    const existing = await prisma.therapist.findFirst({ where: { name: t.name } })
    if (!existing) {
      const created = await prisma.therapist.create({ data: t })
      createdTherapists[t.name] = created.id
      console.log(`✅ Therapist created: ${t.name}`)
    } else {
      createdTherapists[t.name] = existing.id
      console.log(`⏭️  Therapist already exists: ${t.name}`)
    }
  }

  // ─────────────────────────────────────────
  // 4. THERAPIST ACCOUNTS (linked)
  // ─────────────────────────────────────────
  const owner = await prisma.account.findFirst({ where: { role: Role.OWNER } })

  const therapistAccounts = [
    { name: 'Mei Lin',    phone: '+16175550201', password: 'meilin123'  },
    { name: 'Sarah Chen', phone: '+17815550334', password: 'sarah123'   },
    { name: 'David Park', phone: '+13395550189', password: 'david123'   },
  ]

  for (const ta of therapistAccounts) {
    const existing = await prisma.account.findUnique({ where: { phone: ta.phone } })
    if (!existing && createdTherapists[ta.name]) {
      const hash = await bcrypt.hash(ta.password, 12)
      await prisma.account.create({
        data: {
          phone:        ta.phone,
          passwordHash: hash,
          name:         ta.name,
          role:         Role.THERAPIST,
          therapistId:  createdTherapists[ta.name],
          createdById:  owner?.id,
        }
      })
      console.log(`✅ Therapist account created: ${ta.name} (${ta.phone})`)
    } else {
      console.log(`⏭️  Account already exists: ${ta.phone}`)
    }
  }

  // ─────────────────────────────────────────
  // 5. SITE CONFIG (default website content)
  // ─────────────────────────────────────────
  const siteConfig = [
    // Basic info
    { key: 'site_name',        value: 'Carnation Spa',                                             type: SiteConfigType.TEXT     },
    { key: 'site_tagline',     value: 'A sanctuary dedicated to your wellbeing.',                  type: SiteConfigType.TEXT     },
    { key: 'site_phone',       value: '(978) 330-0895',                                            type: SiteConfigType.TEXT     },
    { key: 'site_address',     value: '120 Cambridge St, Suite 8, Burlington, MA 01803',           type: SiteConfigType.TEXT     },
    { key: 'site_hours',       value: 'Monday – Sunday · 9:00 AM – 9:00 PM',                      type: SiteConfigType.TEXT     },
    { key: 'google_maps_url',  value: 'https://maps.google.com/?q=120+Cambridge+St+STE+8+Burlington+MA+01803', type: SiteConfigType.URL },
    // Hero section
    { key: 'hero_title',       value: 'Find Your Stillness',                                       type: SiteConfigType.TEXT     },
    { key: 'hero_subtitle',    value: 'A sanctuary of calm in Burlington, MA. Expert therapists, personalized treatments, lasting results.', type: SiteConfigType.TEXT },
    { key: 'hero_eyebrow',     value: 'carnation spa · burlington, ma',                            type: SiteConfigType.TEXT     },
    { key: 'hero_image_url',   value: '',                                                           type: SiteConfigType.IMAGE    },
    // About section
    { key: 'about_title',      value: 'A Place to Restore & Reconnect',                            type: SiteConfigType.TEXT     },
    { key: 'about_body',       value: 'Founded in 2018, Carnation Spa was born from a simple belief: that true wellness is a harmony of body and mind. We blend time-honored Eastern techniques with modern therapeutic practices.\n\nEvery treatment is thoughtfully crafted to your individual needs, delivered by therapists who bring both expertise and genuine care to each session.', type: SiteConfigType.RICHTEXT },
    { key: 'about_stats_years',    value: '6+',  type: SiteConfigType.TEXT },
    { key: 'about_stats_clients',  value: '2k+', type: SiteConfigType.TEXT },
    { key: 'about_stats_rating',   value: '4.9★',type: SiteConfigType.TEXT },
    // Experience/CTA section
    { key: 'cta_title',        value: 'Begin Your Journey to Wellbeing',                           type: SiteConfigType.TEXT     },
    { key: 'cta_body',         value: 'No account needed. Book in minutes, confirm with your phone. Your next moment of calm is just a few clicks away.', type: SiteConfigType.TEXT },
    // Social links
    { key: 'social_instagram', value: 'https://www.instagram.com/carnationspa01803/',              type: SiteConfigType.URL      },
    { key: 'social_yelp',      value: 'https://www.yelp.com/biz/carnation-spa-burlington',         type: SiteConfigType.URL      },
    { key: 'social_google',    value: 'https://share.google/tVbOATlgm3EiZwDjT',                   type: SiteConfigType.URL      },
    // SMS templates
    { key: 'sms_confirmed',    value: '[Carnation Spa] Booking confirmed!\nService: {service}\nTime: {datetime}\nTherapist: {therapist}\nAddress: 120 Cambridge St, Suite 8, Burlington MA\nDirections: {maps_url}\nManage booking: {token_url}', type: SiteConfigType.TEXT },
    { key: 'sms_reminder_24h', value: "[Carnation Spa] Reminder: You have a massage tomorrow at {time} with {therapist}. See you soon!\nDirections: {maps_url}\nNeed to reschedule? {token_url}", type: SiteConfigType.TEXT },
    { key: 'sms_reminder_2h',  value: '[Carnation Spa] See you in ~2 hours!\nToday at {time} · {therapist}\nDirections: {maps_url}', type: SiteConfigType.TEXT },
  ]

  for (const cfg of siteConfig) {
    await prisma.siteConfig.upsert({
      where:  { key: cfg.key },
      update: {}, // don't overwrite existing values
      create: cfg,
    })
  }
  console.log(`✅ Site config seeded (${siteConfig.length} keys)`)

  console.log('\n🌸 Seeding complete!')
  console.log('\n📋 Default credentials:')
  console.log(`   Owner:  ${ownerPhone} / ${ownerPassword}`)
  console.log('   Mei Lin:    +16175550201 / meilin123')
  console.log('   Sarah Chen: +17815550334 / sarah123')
  console.log('   David Park: +13395550189 / david123')
  console.log('\n⚠️  Change all passwords after first login!\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
