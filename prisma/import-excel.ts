/**
 * JKR International — Excel Product Import Script
 * Run: bun prisma/import-excel.ts
 *
 * Reads upload/Product-2026-06-19.xlsx and imports:
 *  - Parent categories (grouped)
 *  - Sub-categories (from Excel)
 *  - Brands (from Excel)
 *  - Collections (7 curated)
 *  - Products (336, with Cloudinary images)
 */

import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import path from 'path'

const db = new PrismaClient()

// ─── Cloudinary URL builder ───────────────────────────────────────────────────
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dkhblh1sr'

function cloudUrl(publicId: string): string {
  if (!publicId || publicId === 'null' || publicId === 'undefined') return ''
  if (publicId.startsWith('http')) return publicId
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/${publicId}`
}

// ─── Slug helper ──────────────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Category Hierarchy (parent → children) ───────────────────────────────────
const CATEGORY_GROUPS: Record<string, string[]> = {
  'Wheelchairs': [
    'Active Wheelchair',
    'Bariatric Wheelchair',
    'Electric Wheelchair',
    'Geriatric Wheelchairs',
    'Multifunctional Wheelchair',
    'Pediatric Wheelchair',
    'Standard Wheelchair',
    'Wheelchairs',
    'Comfort Chairs',
  ],
  'Seating & Cushions': [
    'Seating Solutions',
    'Wheelchair Cusions',
    'Sit Rings',
    'Comfort Pillow',
    'Chairs',
    'Clinical Chairs/ Stools',
    'Bariatric Couches',
    'Therapy Couches',
    'Medical Couches',
  ],
  'Mobility Aids': [
    'Rollators',
    'Walkers',
    'Walking & Standing Aids',
    'Walking Stick and Canes',
    'Crutches',
    'Transfer Boards',
    'Slide Sheet',
    'Gait Belt',
    'Convertible Staircase',
    'Patient Turner and Mover',
    'Patients Hoists and Slings',
  ],
  'Rehabilitation & Physiotherapy': [
    'Physiotherapy & Rehabilitation Products',
    'Exercise Therapy',
    'Neurological Therapy',
    'Balance Fit Products',
    'Evaluation Products',
    'Parallel Bar',
    'Standers',
    'Hydrotherapy',
    'Wall Bar',
    'Exercise Balls',
    'Pilates and Yoga Products',
    'Cycles',
    'Treadmill',
  ],
  'Electrotherapy': [
    'Interferential Therapy',
    'Tens',
    'Combination Therapy',
    'Ultrasound',
    'Laser Therapy',
    'Shockwave Therapy',
    'Tecar/Care Therapy',
  ],
  'Compression Therapy': [
    'Compression Garments',
    'Compression Stockings',
    'Compression Stockings for Edema Therapy',
    'Compression Stockings for Vein Therapy',
    'Adjustable Compression Garments',
    'Clinical compression stockings',
  ],
  'Orthotics & Prosthetics': [
    'Orthotics',
    'Prosthetics',
    'Prosthetics & Orthotics Services',
  ],
  'Hospital Equipment': [
    'Hospital Beds',
    'Hospital Equipment & Furniture',
    'Patient Beds',
    'Crash Cart',
    'Medication Cart',
    'Stretchers',
    'Homecare',
  ],
  'Traction & Chiropractic': [
    'Advance Portable Meditrac Traction',
    'Advance Traction Devices',
    'Chiropractic',
  ],
  'Pressure Care': [
    'Alternating Pressure Mattress',
  ],
  'Fitness & Weights': [
    'Coated Dumbbells',
    'Fitness Bands',
    'Hand Excerciser',
    'Shoulder Excerciser',
    'Wrist and Ankle Weights',
    'Varigrip Therapy',
  ],
  'Sensory & Relaxation': [
    'Sensory Products',
    'Relaxation',
    'Vibrators & Massagers',
    'Hot and Cold',
    'Hot and Cold Therapy',
  ],
  'Bathing & Commode': [
    'Bathing Chair',
    'Commode Chair',
  ],
  'Knee & Spine': [
    'Knee CPM',
  ],
}

// Build reverse map: child → parent name
const childToParent: Record<string, string> = {}
for (const [parent, children] of Object.entries(CATEGORY_GROUPS)) {
  for (const child of children) {
    childToParent[child] = parent
  }
}

// ─── Collections config ───────────────────────────────────────────────────────
const COLLECTIONS_CONFIG = [
  { name: 'Featured Products', slug: 'featured', description: 'Our handpicked top products' },
  { name: 'On Sale Now', slug: 'on-sale', description: 'Current promotions and discounted items' },
  { name: 'Exclusive Products', slug: 'exclusive', description: 'Exclusive to JKR International' },
  { name: 'Wheelchairs & Mobility', slug: 'wheelchairs-mobility', description: 'Complete range of wheelchairs and mobility aids' },
  { name: 'Rehabilitation Equipment', slug: 'rehabilitation', description: 'Professional physiotherapy and rehabilitation products' },
  { name: 'Hospital & Clinical', slug: 'hospital-clinical', description: 'Hospital beds, equipment, and clinical furniture' },
  { name: 'Compression Therapy', slug: 'compression-therapy', description: 'Medical compression garments and stockings' },
]

async function main() {
  console.log('🌱 JKR International — Excel Import')
  console.log('====================================\n')

  // ── Load Excel ───────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const filePath = path.join(process.cwd(), 'upload', 'Product-2026-06-19.xlsx')
  await wb.xlsx.readFile(filePath)
  const ws = wb.worksheets[0]
  console.log(`📊 Loaded: ${ws.name} (${ws.rowCount} rows)`)

  // ── Collect unique categories and brands from data ───────────────────────────
  const allCategoryNames = new Set<string>()
  const allBrandNames = new Set<string>()
  const rows: any[][] = []

  ws.eachRow((row, i) => {
    if (i === 1) return
    const vals = row.values as any[]
    const isActive = vals[32]
    if (isActive === false || isActive === 'False' || isActive === 'false') return
    rows.push(vals)
    if (vals[4]) allCategoryNames.add(String(vals[4]).trim())
    if (vals[5]) allBrandNames.add(String(vals[5]).trim())
  })

  console.log(`\n📦 Active products: ${rows.length}`)
  console.log(`📂 Categories: ${allCategoryNames.size}`)
  console.log(`🏷️  Brands: ${allBrandNames.size}\n`)

  // ── Step 1: Create parent categories ─────────────────────────────────────────
  console.log('1️⃣  Creating parent categories...')
  const parentCategoryMap: Record<string, string> = {} // name → id

  // Get unique parent names that are actually needed
  const neededParents = new Set<string>()
  for (const catName of allCategoryNames) {
    const parent = childToParent[catName]
    if (parent) neededParents.add(parent)
    else neededParents.add('Other') // fallback parent
  }

  for (const parentName of neededParents) {
    const slug = slugify(parentName)
    const existing = await db.category.findUnique({ where: { slug } })
    if (existing) {
      parentCategoryMap[parentName] = existing.id
      process.stdout.write('.')
      continue
    }
    const created = await db.category.create({
      data: { name: parentName, slug, isActive: true, sortOrder: 0 },
    })
    parentCategoryMap[parentName] = created.id
    process.stdout.write('+')
  }
  console.log(`\n  ✅ ${Object.keys(parentCategoryMap).length} parent categories\n`)

  // ── Step 2: Create child categories ──────────────────────────────────────────
  console.log('2️⃣  Creating child categories...')
  const categoryMap: Record<string, string> = {} // name → id

  for (const catName of allCategoryNames) {
    const slug = slugify(catName)
    const parentName = childToParent[catName] || 'Other'
    const parentId = parentCategoryMap[parentName]

    const existing = await db.category.findUnique({ where: { slug } })
    if (existing) {
      categoryMap[catName] = existing.id
      process.stdout.write('.')
      continue
    }
    const created = await db.category.create({
      data: { name: catName, slug, parentId: parentId || null, isActive: true, sortOrder: 0 },
    })
    categoryMap[catName] = created.id
    process.stdout.write('+')
  }
  console.log(`\n  ✅ ${Object.keys(categoryMap).length} child categories\n`)

  // ── Step 3: Create brands ─────────────────────────────────────────────────────
  console.log('3️⃣  Creating brands...')
  const brandMap: Record<string, string> = {} // name → id

  for (const brandName of allBrandNames) {
    const slug = slugify(brandName)
    const existing = await db.brand.findUnique({ where: { slug } })
    if (existing) {
      brandMap[brandName] = existing.id
      process.stdout.write('.')
      continue
    }
    const created = await db.brand.create({
      data: { name: brandName, slug, isActive: true },
    })
    brandMap[brandName] = created.id
    process.stdout.write('+')
  }
  console.log(`\n  ✅ ${Object.keys(brandMap).length} brands\n`)

  // ── Step 4: Create collections ────────────────────────────────────────────────
  console.log('4️⃣  Creating collections...')
  const collectionMap: Record<string, string> = {} // slug → id

  for (const col of COLLECTIONS_CONFIG) {
    const existing = await db.collection.findUnique({ where: { slug: col.slug } })
    if (existing) {
      collectionMap[col.slug] = existing.id
      process.stdout.write('.')
      continue
    }
    const created = await db.collection.create({
      data: { name: col.name, slug: col.slug, description: col.description, isActive: true },
    })
    collectionMap[col.slug] = created.id
    process.stdout.write('+')
  }
  console.log(`\n  ✅ ${Object.keys(collectionMap).length} collections\n`)

  // ── Step 5: Import products ───────────────────────────────────────────────────
  console.log('5️⃣  Importing products...')
  let created = 0
  let skipped = 0
  let errors = 0

  for (const vals of rows) {
    // Map columns (1-indexed from ExcelJS)
    const excelName   = String(vals[2] || '').trim()
    const sku         = String(vals[3] || '').trim()
    const categoryName = String(vals[4] || '').trim()
    const brandName   = String(vals[5] || '').trim()
    const slug        = String(vals[6] || slugify(excelName)).trim()
    const imagePublicId = String(vals[7] || '').trim()
    const qty         = parseInt(String(vals[9] || '100'))
    const regularPrice = parseFloat(String(vals[11] || '0'))
    const salePrice   = vals[12] ? parseFloat(String(vals[12])) : null
    const features    = String(vals[22] || '').trim()
    const overview    = String(vals[23] || '').trim()
    const techInfo    = String(vals[24] || '').trim()
    const avgRating   = parseFloat(String(vals[26] || '0')) || 0
    const reviewCount = parseInt(String(vals[27] || '0')) || 0
    const badge       = vals[29] ? String(vals[29]).trim() : null
    const isExclusive = vals[30] === true || vals[30] === 'true' || vals[30] === 'True'
    const onSale      = vals[31] === true || vals[31] === 'true' || vals[31] === 'True'

    if (!excelName || !slug) { skipped++; continue }

    // Check duplicate slug
    const exists = await db.product.findUnique({ where: { slug } })
    if (exists) { skipped++; continue }

    const categoryId = categoryName ? categoryMap[categoryName] || null : null
    const brandId = brandName ? brandMap[brandName] || null : null
    const imageUrl = cloudUrl(imagePublicId)

    try {
      const product = await db.product.create({
        data: {
          slug,
          name: excelName,
          sku: sku || null,
          categoryId,
          brandId,
          regularPrice,
          salePrice: onSale && salePrice ? salePrice : null,
          onSale,
          isExclusive,
          isFeatured: avgRating >= 4.5 && reviewCount >= 40,
          badge,
          shortDescription: features || null,
          description: overview || null,
          specifications: techInfo || null,
          stockQty: qty,
          inStock: qty > 0,
          ratingAvg: avgRating,
          ratingCount: reviewCount,
          images: imageUrl
            ? {
                create: {
                  imageUrl,
                  altText: excelName,
                  sortOrder: 0,
                  isPrimary: true,
                },
              }
            : undefined,
        },
      })

      // Assign to collections
      const collectionsToAdd: string[] = []
      if (product.isFeatured) collectionsToAdd.push('featured')
      if (product.onSale) collectionsToAdd.push('on-sale')
      if (product.isExclusive) collectionsToAdd.push('exclusive')

      // Wheelchair & Mobility collection
      const wheelchairCats = CATEGORY_GROUPS['Wheelchairs'].concat(CATEGORY_GROUPS['Mobility Aids'])
      if (categoryName && wheelchairCats.includes(categoryName)) {
        collectionsToAdd.push('wheelchairs-mobility')
      }

      // Rehabilitation collection
      const rehabCats = CATEGORY_GROUPS['Rehabilitation & Physiotherapy'].concat(CATEGORY_GROUPS['Electrotherapy'])
      if (categoryName && rehabCats.includes(categoryName)) {
        collectionsToAdd.push('rehabilitation')
      }

      // Hospital collection
      if (categoryName && CATEGORY_GROUPS['Hospital Equipment'].includes(categoryName)) {
        collectionsToAdd.push('hospital-clinical')
      }

      // Compression collection
      if (categoryName && CATEGORY_GROUPS['Compression Therapy'].includes(categoryName)) {
        collectionsToAdd.push('compression-therapy')
      }

      for (const colSlug of collectionsToAdd) {
        const collectionId = collectionMap[colSlug]
        if (collectionId) {
          await db.collectionProduct.upsert({
            where: { collectionId_productId: { collectionId, productId: product.id } },
            create: { collectionId, productId: product.id },
            update: {},
          })
        }
      }

      created++
      process.stdout.write('.')
    } catch (err: any) {
      errors++
      console.error(`\n  ❌ Failed: ${excelName} — ${err.message}`)
    }
  }

  // ── Step 6: Create admin user ─────────────────────────────────────────────────
  console.log(`\n\n6️⃣  Creating admin user...`)
  const adminEmail = process.env.ADMIN_EMAIL || 'johns.antony@hotmail.com'
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123'

  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await db.user.create({
      data: {
        email: adminEmail,
        password: adminPass,
        firstName: 'Admin',
        lastName: 'JKR',
        role: 'admin',
        isActive: true,
      },
    })
    console.log(`  ✅ Admin created: ${adminEmail}`)
  } else {
    console.log(`  ℹ️  Admin already exists: ${adminEmail}`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n====================================')
  console.log('✅ Import Complete!')
  console.log(`   Products created : ${created}`)
  console.log(`   Products skipped : ${skipped}`)
  console.log(`   Errors           : ${errors}`)
  console.log(`   Parent categories: ${Object.keys(parentCategoryMap).length}`)
  console.log(`   Child categories : ${Object.keys(categoryMap).length}`)
  console.log(`   Brands           : ${Object.keys(brandMap).length}`)
  console.log(`   Collections      : ${Object.keys(collectionMap).length}`)
  console.log('====================================\n')

  await db.$disconnect()
}

main().catch((err) => {
  console.error('💥 Import failed:', err)
  db.$disconnect()
  process.exit(1)
})
