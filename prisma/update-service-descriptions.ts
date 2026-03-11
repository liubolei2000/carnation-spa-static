// prisma/update-service-descriptions.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const updates: { name: string; description: string }[] = [
  {
    name: 'Deep Tissue Massage Therapy',
    description: 'A firm, focused massage that targets the deeper layers of muscle and connective tissue. Ideal for chronic pain, stiff necks, upper back tightness, and muscle recovery after physical activity. Our therapists use slow, deliberate strokes to release tension where you need it most.',
  },
  {
    name: 'Prenatal Massage Therapy',
    description: 'Specially designed for expectant mothers, this gentle side-lying massage eases the aches and discomforts of pregnancy — including lower back pain, swollen legs, and fatigue. Safe, soothing, and nurturing for both mom and baby.',
  },
  {
    name: 'Massage Therapy 90 min',
    description: 'Our most thorough full-body session. With 90 minutes of uninterrupted care, your therapist can address every area of tension from scalp to sole, blending techniques to suit your body\'s needs. Perfect when you truly want to reset.',
  },
  {
    name: 'Swedish Massage Therapy',
    description: 'The classic relaxation massage. Using long gliding strokes, kneading, and rhythmic tapping, Swedish massage boosts circulation, loosens tight muscles, and melts away everyday stress. A great starting point for first-time visitors.',
  },
  {
    name: 'Facial Care',
    description: 'A revitalizing facial treatment that deep-cleanses pores, exfoliates dead skin cells, and replenishes moisture. Leaves your complexion visibly brighter, smoother, and refreshed — no makeup needed afterward.',
  },
  {
    name: 'Head Therapy',
    description: 'A dedicated scalp and head massage that stimulates circulation, relieves tension headaches, and soothes eye strain. Incorporating acupressure points, this treatment also helps ease insomnia and quiet an overactive mind.',
  },
  {
    name: 'Foot Massage Therapy 60 min',
    description: 'A comprehensive reflexology session working the full map of pressure points on your feet. Each zone corresponds to organs and systems throughout your body, promoting overall wellness, improved sleep, and deep relaxation from the ground up.',
  },
  {
    name: 'Foot Massage Therapy 30 min',
    description: 'A quick yet effective foot relief session — perfect for a lunch break or after a long day on your feet. Targets arch tension, heel soreness, and tired soles so you leave feeling light and refreshed.',
  },
  {
    name: 'Combo',
    description: 'Can\'t choose just one? Our Combo session lets you mix and match — full body, head, foot, or facial care. Your therapist will tailor the session to whatever your body is calling for that day, all in one appointment.',
  },
  {
    name: 'Cupping',
    description: 'Traditional cupping therapy uses gentle suction to lift the tissue, increase blood flow, and release deep-seated muscle tension. Known for easing stiffness, reducing inflammation, and leaving you feeling remarkably lighter. Light circular marks may appear temporarily and are a normal sign of the treatment working.',
  },
  {
    name: 'Hot Stone (Add-on)',
    description: 'Complimentary add-on with any massage. Smooth, heated basalt stones are placed along key energy points to deliver penetrating warmth deep into the muscles. The heat amplifies the effects of your massage, melting tension faster and leaving you in a state of pure calm.',
  },
  {
    name: 'Package — 5 Sessions',
    description: 'Your wellness routine, made easy. Prepay for 5 sessions and enjoy an average of just $65 per visit — saving $75 compared to drop-in pricing. Sessions are flexible: choose any service, any therapist, any time. The best gift you can give yourself.',
  },
  {
    name: 'Package — 10 Sessions',
    description: 'Commit to your health and feel the difference over time. 10 prepaid sessions bring your average down to just $60 each — a $200 saving. Regular massage improves posture, reduces chronic pain, and dramatically enhances sleep quality. Also makes a thoughtful gift for someone you care about.',
  },
]

async function main() {
  console.log(`Updating descriptions for ${updates.length} services…\n`)

  for (const { name, description } of updates) {
    const svc = await prisma.service.findFirst({ where: { name } })
    if (!svc) { console.log(`  ✗ Not found: ${name}`); continue }
    await prisma.service.update({ where: { id: svc.id }, data: { description } })
    console.log(`  ✓ Updated: ${name}`)
  }

  console.log('\nDone!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
