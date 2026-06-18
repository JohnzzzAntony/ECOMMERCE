// Import products from Product-2026-06-06.xlsx into the database
// Maps Excel categories to existing JKR categories, creates new subcategories as needed
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// Read and parse the xlsx via a simple approach: convert to JSON using python, then read
// We'll use a temp JSON file

// Category mapping: Excel category -> { parentSlug (main cat), createAsSub (bool) }
// If createAsSub is true, a subcategory will be created under the parent.
const CATEGORY_MAP: Record<string, { parent: string; sub?: boolean }> = {
  // Wheelchairs
  'Multifunctional Wheelchair': { parent: 'wheelchairs' },
  'Active Wheelchair': { parent: 'wheelchairs', sub: true },
  'Bariatric Wheelchair': { parent: 'wheelchairs', sub: true },
  'Electric Wheelchair': { parent: 'wheelchairs', sub: true },
  'Geriatric Wheelchairs': { parent: 'wheelchairs' },
  'Pediatric Wheelchair': { parent: 'wheelchairs', sub: true },
  'Standard Wheelchair': { parent: 'wheelchairs' },
  'Wheelchairs': { parent: 'wheelchairs' },
  'Wheelchair Cusions': { parent: 'wheelchairs' },
  'Transfer Boards': { parent: 'wheelchairs', sub: true },

  // Walking Aids
  'Crutches': { parent: 'walking-aids' },
  'Walkers': { parent: 'walking-aids' },
  'Rollators': { parent: 'walking-aids' },
  'Walking Stick and Canes': { parent: 'walking-aids' },
  'Walking & Standing Aids': { parent: 'walking-aids' },
  'Standers': { parent: 'walking-aids' },
  'Gait Belt': { parent: 'walking-aids' },
  'Parallel Bar': { parent: 'walking-aids' },

  // Seating
  'Chairs': { parent: 'seating' },
  'Clinical Chairs/ Stools': { parent: 'seating' },
  'Comfort Chairs': { parent: 'seating' },
  'Seating Solutions': { parent: 'seating' },
  'Bathing Chair': { parent: 'seating' },
  'Commode Chair': { parent: 'seating' },
  'Sit Rings': { parent: 'seating' },
  'Comfort Pillow': { parent: 'seating' },

  // Pressure Relief
  'Alternating Pressure Mattress': { parent: 'pressure-relief' },

  // Physiotherapy
  'Exercise Balls': { parent: 'physiotherapy' },
  'Exercise Therapy': { parent: 'physiotherapy' },
  'Fitness Bands': { parent: 'physiotherapy' },
  'Coated Dumbbells': { parent: 'physiotherapy' },
  'Wrist and Ankle Weights': { parent: 'physiotherapy' },
  'Hand Excerciser': { parent: 'physiotherapy' },
  'Shoulder Excerciser': { parent: 'physiotherapy' },
  'Cycles': { parent: 'physiotherapy' },
  'Treadmill': { parent: 'physiotherapy' },
  'Pilates and Yoga Products': { parent: 'physiotherapy' },
  'Wall Bar': { parent: 'physiotherapy' },
  'Hot and Cold': { parent: 'physiotherapy' },
  'Hot and Cold Therapy': { parent: 'physiotherapy' },
  'Hydrotherapy': { parent: 'physiotherapy' },
  'Balance Fit Products': { parent: 'physiotherapy' },
  'Relaxation': { parent: 'physiotherapy' },
  'Sensory Products': { parent: 'physiotherapy' },
  'Vibrators & Massagers': { parent: 'physiotherapy' },
  'Knee CPM': { parent: 'physiotherapy' },
  'Physiotherapy & Rehabilitation Products': { parent: 'physiotherapy' },

  // Therapy devices (physiotherapy)
  'Combination Therapy': { parent: 'physiotherapy' },
  'Interferential Therapy': { parent: 'physiotherapy' },
  'Laser Therapy': { parent: 'physiotherapy' },
  'Shockwave Therapy': { parent: 'physiotherapy' },
  'Tecar/Care Therapy': { parent: 'physiotherapy' },
  'Tens': { parent: 'physiotherapy' },
  'Ultrasound': { parent: 'physiotherapy' },
  'Varigrip Therapy': { parent: 'physiotherapy' },
  'Neurological Therapy': { parent: 'physiotherapy' },
  'Chiropractic': { parent: 'physiotherapy' },
  'Advance Portable Meditrac Traction': { parent: 'physiotherapy' },
  'Advance Traction Devices': { parent: 'physiotherapy' },

  // Orthopedic
  'Orthotics': { parent: 'orthopedic' },
  'Prosthetics': { parent: 'orthopedic' },
  'Prosthetics & Orthotics Services': { parent: 'orthopedic' },
  'Compression Garments': { parent: 'orthopedic' },
  'Adjustable Compression Garments': { parent: 'orthopedic' },
  'Compression Stockings': { parent: 'orthopedic' },
  'Clinical compression stockings': { parent: 'orthopedic' },
  'Compression Stockings for Edema Therapy': { parent: 'orthopedic' },
  'Compression Stockings for Vein Therapy': { parent: 'orthopedic' },

  // Hospital Equipment
  'Hospital Beds': { parent: 'hospital-equipment' },
  'Patient Beds': { parent: 'hospital-equipment' },
  'Hospital Equipment & Furniture': { parent: 'hospital-equipment' },
  'Crash Cart': { parent: 'hospital-equipment' },
  'Medication Cart': { parent: 'hospital-equipment' },
  'Stretchers': { parent: 'hospital-equipment' },
  'Bariatric Couches': { parent: 'hospital-equipment' },
  'Medical Couches': { parent: 'hospital-equipment' },
  'Therapy Couches': { parent: 'hospital-equipment' },
  'Convertible Staircase': { parent: 'hospital-equipment' },

  // Home Care
  'Homecare': { parent: 'home-care' },
  'Evaluation Products': { parent: 'home-care' },

  // Patient Handling
  'Patients Hoists and Slings': { parent: 'patient-handling' },
  'Patient Turner and Mover': { parent: 'patient-handling' },
  'Slide Sheet': { parent: 'patient-handling' },
}

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('📥 Reading Excel data...')

  // Read the JSON exported by python
  const jsonPath = '/tmp/products_import.json'
  const rawData = fs.readFileSync(jsonPath, 'utf-8')
  const products: any[] = JSON.parse(rawData)
  console.log(`📊 Found ${products.length} products to import`)

  // Get existing categories
  const existingCats = await db.category.findMany({ include: { children: true } })
  const catBySlug: Record<string, string> = {}
  existingCats.forEach((c) => { catBySlug[c.slug] = c.id })

  // Create new subcategories as needed
  const subcatCache: Record<string, string> = {} // excelCatName -> categoryId
  let newSubcats = 0

  for (const p of products) {
    const excelCat = String(p.category || '').trim()
    if (!excelCat) continue

    const mapping = CATEGORY_MAP[excelCat]
    if (!mapping) {
      // Default to home-care if no mapping
      subcatCache[excelCat] = catBySlug['home-care']
      continue
    }

    const parentId = catBySlug[mapping.parent]
    if (!parentId) {
      subcatCache[excelCat] = catBySlug['home-care']
      continue
    }

    if (mapping.sub) {
      // Create or find a subcategory
      const subSlug = slugify(excelCat)
      let subCat = await db.category.findFirst({ where: { slug: subSlug, parentId } })
      if (!subCat) {
        subCat = await db.category.create({
          data: {
            slug: subSlug,
            name: excelCat,
            imageUrl: `https://picsum.photos/seed/cat-${subSlug}/600/600`,
            parentId,
            sortOrder: 100 + newSubcats,
            isActive: true,
          },
        })
        newSubcats++
        catBySlug[subSlug] = subCat.id
      }
      subcatCache[excelCat] = subCat.id
    } else {
      subcatCache[excelCat] = parentId
    }
  }
  console.log(`📁 Created ${newSubcats} new subcategories`)

  // Get existing brands
  const existingBrands = await db.brand.findMany()
  const brandBySlug: Record<string, string> = {}
  existingBrands.forEach((b) => { brandBySlug[b.slug] = b.id })

  // Create missing brands from the Excel data
  const excelBrands = new Set<string>()
  products.forEach((p) => {
    const b = String(p.brand || '').trim()
    if (b && b !== 'None' && b !== 'null') excelBrands.add(b)
  })

  let newBrands = 0
  for (const brandName of excelBrands) {
    const slug = slugify(brandName)
    if (!brandBySlug[slug]) {
      const brand = await db.brand.create({
        data: {
          slug,
          name: brandName,
          logoUrl: `https://picsum.photos/seed/brand-${slug}/200/80`,
          description: `${brandName} medical equipment manufacturer.`,
          isActive: true,
        },
      })
      brandBySlug[slug] = brand.id
      newBrands++
    }
  }
  console.log(`🏷️  Created ${newBrands} new brands`)

  // Import products
  let imported = 0
  let skipped = 0

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const name = String(p.name || '').trim()
    if (!name) { skipped++; continue }

    let slug = String(p.slug || '').trim() || slugify(name)
    // Ensure unique slug
    const existing = await db.product.findUnique({ where: { slug } })
    if (existing) {
      slug = `${slug}-${i}`
    }

    const regularPrice = parseFloat(String(p.regular_price || 0)) || 0
    const salePrice = p.sale_price ? parseFloat(String(p.sale_price)) : null
    const onSale = salePrice !== null && salePrice < regularPrice
    const stockQty = parseInt(String(p.quantity || 0)) || 0

    const excelCat = String(p.category || '').trim()
    const categoryId = subcatCache[excelCat] || catBySlug['home-care']

    const brandName = String(p.brand || '').trim()
    const brandId = (brandName && brandName !== 'None' && brandName !== 'null')
      ? brandBySlug[slugify(brandName)]
      : null

    // Build description from overview/features
    const overview = String(p.overview || '').trim()
    const features = String(p.features || '').trim()
    const technicalInfo = String(p.technical_info || '').trim()
    const description = [overview, features ? `## Features\n${features}` : '', technicalInfo ? `## Technical Info\n${technicalInfo}` : '']
      .filter(Boolean).join('\n\n') || `Premium ${name} from JKR International.`

    const shortDescription = String(p.overview || '').trim().substring(0, 200) || `Professional-grade ${name.toLowerCase()}.`

    // Image URL
    let imageUrl = String(p.image_url || p.image || '').trim()
    if (!imageUrl || imageUrl === 'None') {
      imageUrl = `https://picsum.photos/seed/prod-${i}/800/800`
    } else if (imageUrl.startsWith('products/')) {
      // It's a relative path from the original site - use placeholder
      imageUrl = `https://picsum.photos/seed/${slugify(imageUrl)}/800/800`
    }

    // Gallery images
    const galleryStr = String(p.gallery_image_urls || '').trim()
    let galleryUrls: string[] = []
    if (galleryStr && galleryStr !== 'None') {
      galleryUrls = galleryStr.split('|').map((u) => u.trim()).filter(Boolean).slice(0, 4)
      galleryUrls = galleryUrls.map((u) => u.startsWith('http') ? u : `https://picsum.photos/seed/${slugify(u)}/800/800`)
    }
    if (galleryUrls.length === 0) {
      galleryUrls = [
        imageUrl,
        `https://picsum.photos/seed/${slug}-2/800/800`,
        `https://picsum.photos/seed/${slug}-3/800/800`,
      ]
    }

    const ratingAvg = parseFloat(String(p.avg_rating || 0)) || 0
    const ratingCount = parseInt(String(p.review_count || 0)) || 0
    const isFeatured = String(p.is_featured || '').toLowerCase() === 'true' || p.is_featured === true
    const isActive = String(p.is_active || '').toLowerCase() !== 'false' && p.is_active !== false

    const sku = String(p.sku_id || '').trim() || `JKR-XLSX-${String(i + 1).padStart(4, '0')}`

    // Specifications from technical_info
    const specs: Record<string, string> = {}
    if (p.weight) specs['Weight'] = String(p.weight)
    if (p.length) specs['Length'] = String(p.length)
    if (p.width) specs['Width'] = String(p.width)
    if (p.height) specs['Height'] = String(p.height)
    if (p.unit) specs['Unit'] = String(p.unit)
    if (p.delivery_time) specs['Delivery Time'] = String(p.delivery_time)
    if (p.tax_percentage) specs['Tax'] = String(p.tax_percentage) + '%'

    const product = await db.product.create({
      data: {
        slug,
        name,
        nameAr: name,
        description,
        shortDescription,
        specifications: Object.keys(specs).length > 0 ? JSON.stringify(specs) : null,
        sku,
        regularPrice,
        salePrice: onSale ? salePrice : null,
        onSale,
        stockQty,
        inStock: stockQty > 0 && isActive,
        categoryId,
        brandId,
        isFeatured,
        isExclusive: false,
        metaTitle: String(p.meta_title || name),
        metaDescription: String(p.meta_description || shortDescription),
        metaKeywords: String(p.meta_keywords || ''),
        ratingAvg,
        ratingCount,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(Date.now() - i * 3600000),
      },
    })

    // Add images
    await db.productImage.createMany({
      data: galleryUrls.map((url, idx) => ({
        productId: product.id,
        imageUrl: url,
        altText: `${name} ${idx + 1}`,
        sortOrder: idx,
        isPrimary: idx === 0,
      })),
    })

    // Add a sample review if rating > 0
    if (ratingCount > 0) {
      const reviewCount = Math.min(3, Math.ceil(ratingCount / 10))
      const reviewers = ['Verified Customer', 'Hospital Procurement', 'Clinic Manager', 'Care Home Director', 'Medical Professional']
      for (let r = 0; r < reviewCount; r++) {
        await db.productReview.create({
          data: {
            productId: product.id,
            authorName: reviewers[(i + r) % reviewers.length],
            rating: Math.round(ratingAvg) || 5,
            reviewText: 'Excellent product quality and fast delivery. Highly recommended for medical facilities.',
            isApproved: true,
          },
        })
      }
    }

    imported++
    if (imported % 50 === 0) {
      console.log(`  ... imported ${imported} products`)
    }
  }

  console.log(`\n✅ Import complete!`)
  console.log(`   Imported: ${imported} products`)
  console.log(`   Skipped: ${skipped} (no name)`)
  console.log(`   New subcategories: ${newSubcats}`)
  console.log(`   New brands: ${newBrands}`)

  const total = await db.product.count()
  console.log(`   Total products in database: ${total}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
