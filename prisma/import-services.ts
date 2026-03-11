// prisma/import-services.ts
// 运行: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-services.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const services = [
  {
    name: 'Deep Tissue Massage Therapy',
    description: '专注于肌肉深层与结缔组织的强效按摩疗程，精准释放长期积累的慢性疼痛与肌肉结节，特别适合运动后恢复及肩颈腰背酸痛人群。',
    durationMin: 60,
    price: 80,
    sortOrder: 0,
  },
  {
    name: 'Prenatal Massage Therapy',
    description: '专为孕期妈妈设计的安全舒缓疗程，采用侧卧舒适体位，有效缓解孕期腰背酸胀、腿部水肿及身体疲劳，给准妈妈带来温柔全面的放松体验。',
    durationMin: 60,
    price: 80,
    sortOrder: 1,
  },
  {
    name: 'Massage Therapy 90 min',
    description: '90分钟深度全身放松疗程，从头皮到脚底系统性舒缓肌肉疲劳，比60分钟疗程更充裕的时间让您彻底卸下压力，恢复身体活力与平衡。',
    durationMin: 90,
    price: 110,
    sortOrder: 2,
  },
  {
    name: 'Swedish Massage Therapy',
    description: '经典瑞典式全身按摩，运用长滑推抚、揉捏、叩击等手法促进血液与淋巴循环，舒缓肌肉紧张，消除日常压力，是初次体验按摩的最佳选择。',
    durationMin: 60,
    price: 70,
    sortOrder: 3,
  },
  {
    name: 'Facial Care',
    description: '专业面部护理疗程，结合深层清洁、蒸汽软化与补水滋养，有效改善暗沉肤色与毛孔粗大，令肌肤细腻透亮、焕发自然光彩。',
    durationMin: 60,
    price: 80,
    sortOrder: 4,
  },
  {
    name: 'Head Therapy',
    description: '头部专项疗愈，结合头皮深层按摩与精准穴位刺激，有效缓解偏头痛、长期失眠及视觉疲劳，促进头部血液循环，让紧绷的神经彻底放松。',
    durationMin: 60,
    price: 90,
    sortOrder: 5,
  },
  {
    name: 'Foot Massage Therapy 60 min',
    description: '专业足底反射区全套按摩，通过刺激脚底对应各脏腑器官的反射区，调节全身机能、消除一天的疲惫，同时促进血液循环与深度睡眠质量。',
    durationMin: 60,
    price: 60,
    sortOrder: 6,
  },
  {
    name: 'Foot Massage Therapy 30 min',
    description: '30分钟快速足部舒缓疗程，集中护理脚底疲劳与足弓酸痛，适合午休或下班后快速恢复活力，轻松又实惠。',
    durationMin: 30,
    price: 40,
    sortOrder: 7,
  },
  {
    name: 'Combo',
    description: '灵活组合疗程，可自由搭配全身按摩、头部、足部或面部护理，由技师根据您当日身体状态定制，一次享受多重疗愈效果。',
    durationMin: 60,
    price: 70,
    sortOrder: 8,
  },
  {
    name: 'Cupping',
    description: '传统中式拔罐疗法，利用负压原理吸附皮肤，促进局部气血循环、排毒祛湿，有效缓解肌肉僵硬与经络瘀堵，是深受欢迎的中医辅助疗法。',
    durationMin: 30,
    price: 30,
    sortOrder: 9,
  },
  {
    name: 'Hot Stone (Add-on)',
    description: '免费附加项目！精选天然玄武岩热石置于身体关键穴位，持续温热渗透肌肉深层，配合按摩手法效果倍增，让身心在温暖中彻底舒展。',
    durationMin: 0,
    price: 0,
    sortOrder: 10,
  },
  {
    name: 'Package — 5 Sessions',
    description: '5次套餐优惠，平均每次仅$65，节省$75！适合希望持续调理身体的客人，购买后预约灵活，项目可自选，是送给自己最好的健康投资。',
    durationMin: 60,
    price: 325,
    sortOrder: 11,
  },
  {
    name: 'Package — 10 Sessions',
    description: '10次超值套餐，平均每次仅$60，节省$200！长期坚持专业按摩护理，从根本上改善体质与睡眠，也是馈赠亲友的暖心健康礼品首选。',
    durationMin: 60,
    price: 600,
    sortOrder: 12,
  },
]

async function main() {
  console.log(`准备导入 ${services.length} 个项目…`)

  for (const svc of services) {
    const existing = await prisma.service.findFirst({ where: { name: svc.name } })
    if (existing) {
      console.log(`  跳过（已存在）: ${svc.name}`)
      continue
    }
    await prisma.service.create({ data: { ...svc, price: svc.price } })
    console.log(`  ✓ 已创建: ${svc.name}  ${svc.durationMin}min  $${svc.price}`)
  }

  console.log('\n导入完成！')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
