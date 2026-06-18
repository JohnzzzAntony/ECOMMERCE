// Additional blog posts seed
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const medicalImg = (seed: number, w = 1200, h = 600) =>
  `https://picsum.photos/seed/blog2-${seed}/${w}/${h}`

async function main() {
  console.log('🌱 Adding 6 more blog posts...')

  const posts = [
    { slug: 'wheelchair-maintenance-guide', title: 'Wheelchair Maintenance: A Complete Care Guide', category: 'Maintenance', excerpt: 'Keep your wheelchair in top condition with these essential maintenance tips.', content: 'Regular wheelchair maintenance ensures safety and longevity...\n\n## Daily Checks\n\nInspect tires, brakes, and frame.\n\n## Weekly Tasks\n\nClean upholstery, check wheel alignment.\n\n## Monthly Service\n\nLubricate moving parts, tighten bolts.\n\n## Professional Service\n\nAnnual check-up by JKR technicians.' },
    { slug: 'choosing-blood-pressure-monitor', title: 'How to Choose the Right Blood Pressure Monitor', category: 'Buying Guides', excerpt: 'Expert tips for selecting an accurate and reliable blood pressure monitor.', content: 'Blood pressure monitors come in many types...\n\n## Types\n\nUpper arm, wrist, and finger monitors.\n\n## Accuracy\n\nUpper arm monitors are most accurate.\n\n## Features to Look For\n\nMemory, large display, irregular heartbeat detection.\n\n## Top Brands\n\nPhilips, Omron, and Medline recommended.' },
    { slug: 'patient-transfer-safety', title: 'Safe Patient Transfer Techniques for Caregivers', category: 'Healthcare Tips', excerpt: 'Learn proper transfer techniques to prevent injuries for both patient and caregiver.', content: 'Patient transfers require proper technique...\n\n## Preparation\n\nAssess patient mobility, clear the path.\n\n## Equipment\n\nUse transfer boards, gait belts, and hoists.\n\n## Technique\n\nBend knees, keep back straight, communicate.\n\n## Safety Tips\n\nNever lift alone, use proper body mechanics.' },
    { slug: 'home-oxygen-safety', title: 'Home Oxygen Therapy: Safety Guidelines', category: 'Respiratory Care', excerpt: 'Essential safety practices for patients using oxygen therapy at home.', content: 'Oxygen therapy safety is critical...\n\n## Fire Safety\n\nNo smoking or open flames within 5 meters.\n\n## Storage\n\nStore cylinders upright, secured, away from heat.\n\n## Ventilation\n\nEnsure good airflow in the room.\n\n## Travel\n\nUse portable concentrators, carry prescription.' },
    { slug: 'pediatric-equipment-guide', title: 'Pediatric Medical Equipment: What Parents Need to Know', category: 'Buying Guides', excerpt: 'A guide to selecting appropriate medical equipment for children.', content: 'Choosing pediatric equipment requires special consideration...\n\n## Sizing\n\nEnsure proper fit for child\'s age and size.\n\n## Safety\n\nLook for rounded edges, non-toxic materials.\n\n## Adjustability\n\nChoose equipment that grows with the child.\n\n## Brands\n\nKirton and Invacare offer excellent pediatric lines.' },
    { slug: 'rehabilitation-after-surgery', title: 'Post-Surgery Rehabilitation: Equipment Essentials', category: 'Rehabilitation', excerpt: 'Key equipment to support recovery after orthopedic surgery.', content: 'Post-surgery rehab needs proper equipment...\n\n## Mobility Aids\n\nWalkers, crutches, and canes for support.\n\n## Exercise Equipment\n\nResistance bands, exercise balls for strengthening.\n\n## Pain Management\n\nHot/cold therapy packs, TENS units.\n\n## Recovery Timeline\n\nFollow your physiotherapist\'s guidance for gradual return to activity.' },
  ]

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
    const existing = await db.blogPost.findUnique({ where: { slug: p.slug } })
    if (existing) continue

    await db.blogPost.create({
      data: {
        slug: p.slug,
        title: p.title,
        titleAr: p.title,
        excerpt: p.excerpt,
        content: p.content,
        contentAr: p.content,
        category: p.category,
        tags: `${p.category}, UAE, Medical Equipment`,
        authorName: 'JKR Editorial',
        coverImageUrl: medicalImg(i + 10),
        isPublished: true,
        publishedAt: new Date(Date.now() - (7 + i) * 86400000),
        metaTitle: p.title,
        metaDescription: p.excerpt,
      },
    })
  }

  const total = await db.blogPost.count()
  console.log(`✅ Done! Total blog posts now: ${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
