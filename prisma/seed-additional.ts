// Additional seed: adds 20 more products with varied dates (some recent for "New Arrivals")
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const medicalImg = (seed: number, w = 800, h = 800) =>
  `https://picsum.photos/seed/med2-${seed}/${w}/${h}`

async function main() {
  console.log('🌱 Adding 20 more products...')

  // Fetch existing categories + brands
  const categories = await db.category.findMany({ where: { parentId: null } })
  const subcats = await db.category.findMany({ where: { parentId: { not: null } } })
  const brands = await db.brand.findMany()
  const collections = await db.collection.findMany()

  const catMap: Record<string, string> = {}
  categories.forEach((c) => (catMap[c.slug] = c.id))
  const subMap: Record<string, string> = {}
  subcats.forEach((s) => (subMap[s.slug] = s.id))
  const brandMap: Record<string, string> = {}
  brands.forEach((b) => (brandMap[b.slug] = b.id))
  const colMap: Record<string, string> = {}
  collections.forEach((c) => (colMap[c.slug] = c.id))

  const newProducts = [
    { slug: 'electric-suction-unit-portable', name: 'Portable Electric Suction Unit', cat: 'respiratory', brand: 'philips', regular: 1850, sale: 1550, stock: 12, featured: false, specs: { 'Flow Rate': '25 L/min', 'Vacuum': '0-0.08 MPa', 'Container': '1000ml', 'Power': 'AC/DC', 'Portable': 'Yes' } },
    { slug: 'digital-thermometer-infrared-forehead', name: 'Infrared Forehead Thermometer Pro', cat: 'diagnostics', brand: 'philips', regular: 220, sale: null, stock: 80, specs: { 'Measurement': 'Forehead', 'Range': '32-42.9°C', 'Accuracy': '±0.1°C', 'Memory': '50 readings', 'Color Alarm': 'Yes' } },
    { slug: 'bipap-machine-bipap-a40', name: 'BiPAP Machine A40', cat: 'respiratory', brand: 'philips', regular: 12500, sale: 10800, stock: 3, featured: true, exclusive: true, specs: { 'Mode': 'BiPAP', 'Pressure': '4-30 cmH2O', 'Humidifier': 'Included', 'Display': 'Color LCD', 'Data': 'Bluetooth' } },
    { slug: 'wheelchair-cushion-anti-thrust', name: 'Wheelchair Anti-Thrust Cushion', cat: 'pressure-relief', brand: 'invacare', regular: 580, sale: 490, stock: 25, specs: { 'Size': '40×40 cm', 'Material': 'High-density foam', 'Cover': 'Waterproof', 'Washable': 'Yes', 'Anti-thrust': 'Yes' } },
    { slug: 'walking-stick-quadruple-base', name: 'Quadruple Base Walking Stick', cat: 'walking-aids', brand: 'drive-devilbiss', regular: 180, sale: null, stock: 60, specs: { 'Height': '71-96 cm', 'Base': 'Quadruple', 'Material': 'Aluminum', 'Weight Capacity': '136 kg', 'Tip': 'Rubber' } },
    { slug: 'examination-couch-3-section', name: '3-Section Examination Couch', cat: 'hospital-equipment', brand: 'medline', regular: 2400, sale: 2100, stock: 8, featured: true, specs: { 'Length': '185 cm', 'Sections': '3', 'Material': 'Powder-coated steel', 'Foam': 'High-density', 'Adjustable': 'Head section' } },
    { slug: 'pulse-oximeter-pediatric', name: 'Pediatric Pulse Oximeter', cat: 'diagnostics', brand: 'medline', regular: 140, sale: 115, stock: 90, specs: { 'Display': 'OLED', 'Measurement': 'SpO2 & PR', 'Power': '2×AAA', 'Auto-off': 'Yes', 'Pediatric': 'Yes' } },
    { slug: 'bed-wedge-pillow-orthopedic', name: 'Orthopedic Bed Wedge Pillow', cat: 'orthopedic', brand: 'invacare', regular: 320, sale: null, stock: 40, specs: { 'Size': '60×40 cm', 'Angle': '30°', 'Material': 'Memory foam', 'Cover': 'Removable', 'Washable': 'Yes' } },
    { slug: 'commode-shower-chair-foldable', name: 'Foldable Shower Commode Chair', cat: 'home-care', brand: 'drive-devilbiss', regular: 1650, sale: 1390, stock: 15, specs: { 'Material': 'Aluminum', 'Weight Capacity': '136 kg', 'Wheels': '4×4 inch', 'Foldable': 'Yes', 'Bucket': 'Included' } },
    { slug: 'blood-glucose-monitor-kit', name: 'Blood Glucose Monitor Kit', cat: 'diagnostics', brand: 'medline', regular: 160, sale: 130, stock: 120, featured: true, specs: { 'Measurement': 'Blood glucose', 'Sample': '0.5 µL', 'Memory': '450 readings', 'Strip': '10 included', 'Lancets': '10 included' } },
    { slug: 'rehabilitation-bike-motorized', name: 'Motorized Rehabilitation Bike', cat: 'physiotherapy', brand: 'ottobock', regular: 14500, sale: null, stock: 4, exclusive: true, specs: { 'Type': 'Motorized', 'Speed': '0-15 km/h', 'Display': 'LCD', 'Programs': '12', 'Weight Capacity': '150 kg' } },
    { slug: 'portable-ecg-machine-3-channel', name: 'Portable 3-Channel ECG Machine', cat: 'diagnostics', brand: 'philips', regular: 8500, sale: 7400, stock: 6, featured: true, specs: { 'Channels': '3', 'Display': '5 inch LCD', 'Recording': 'Thermal printer', 'Battery': 'Rechargeable', 'Weight': '1.5 kg' } },
    { slug: 'wheelchair-ramp-folding-portable', name: 'Portable Folding Wheelchair Ramp', cat: 'mobility', brand: 'drive-devilbiss', regular: 980, sale: 820, stock: 18, specs: { 'Length': '180 cm', 'Width': '72 cm', 'Material': 'Aluminum', 'Weight Capacity': '272 kg', 'Foldable': 'Yes' } },
    { slug: 'oxygen-cylinder-trolley', name: 'Oxygen Cylinder Trolley', cat: 'respiratory', brand: 'medline', regular: 380, sale: null, stock: 35, specs: { 'Material': 'Chrome steel', 'Wheels': '4 casters', 'Capacity': 'D/E cylinders', 'Brake': 'Yes', 'Chain': 'Safety' } },
    { slug: 'hot-cold-therapy-pack-reusable', name: 'Reusable Hot & Cold Therapy Pack', cat: 'physiotherapy', brand: 'dynarex', regular: 65, sale: 49, stock: 200, specs: { 'Size': '15×25 cm', 'Material': 'PVC', 'Reusable': 'Yes', 'Hot/Cold': 'Both', 'Gel': 'Non-toxic' } },
    { slug: 'examination-light-led-mobile', name: 'LED Mobile Examination Light', cat: 'hospital-equipment', brand: 'philips', regular: 4200, sale: 3650, stock: 7, featured: true, specs: { 'Illumination': '45,000 lux', 'Color Temp': '4500K', 'LED': 'Yes', 'Mobile': 'Wheeled base', 'Adjustable': 'Arm' } },
    { slug: 'wrist-blood-pressure-monitor', name: 'Wrist Blood Pressure Monitor', cat: 'diagnostics', brand: 'philips', regular: 290, sale: 240, stock: 65, specs: { 'Type': 'Wrist', 'Display': 'LCD', 'Memory': '90 readings', 'Power': '2×AAA', 'Cuff': '13.5-21.5 cm' } },
    { slug: 'suction-machine-liner-system', name: 'Suction Machine with Liner System', cat: 'respiratory', brand: 'medline', regular: 1650, sale: null, stock: 10, specs: { 'Flow Rate': '20 L/min', 'Vacuum': '0-0.07 MPa', 'Liner': 'Disposable', 'Capacity': '1000ml', 'Power': 'AC' } },
    { slug: 'cpap-mask-nasal-pillow', name: 'CPAP Nasal Pillow Mask', cat: 'respiratory', brand: 'philips', regular: 380, sale: 320, stock: 50, specs: { 'Type': 'Nasal pillow', 'Sizes': 'S/M/L included', 'Headgear': 'Soft', 'Quiet': 'Yes', 'Compatible': 'Standard' } },
    { slug: 'transfer-belt-patient-handling', name: 'Patient Transfer Belt', cat: 'patient-handling', brand: 'dynarex', regular: 95, sale: null, stock: 100, specs: { 'Width': '5 cm', 'Material': 'Nylon', 'Buckle': 'Metal', 'Weight Capacity': '180 kg', 'Sizes': 'S-XL' } },
  ]

  for (let i = 0; i < newProducts.length; i++) {
    const p = newProducts[i]
    const existing = await db.product.findUnique({ where: { slug: p.slug } })
    if (existing) continue

    const onSale = p.sale !== null && p.sale !== undefined
    // Make the first 4 products "new" (created recently)
    const createdAt = i < 4
      ? new Date(Date.now() - i * 24 * 60 * 60 * 1000) // last 0-3 days
      : new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000) // 10+ days ago

    const product = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        nameAr: p.name,
        description: `The ${p.name} is a premium medical equipment product from JKR International, designed and manufactured to the highest healthcare standards. Trusted by hospitals, clinics, and home-care providers across the UAE.\n\nThis product is sourced from globally certified manufacturers and meets ISO 9001 quality standards. Our expert team in Dubai and Abu Dhabi provides full after-sales support, installation, and training.`,
        shortDescription: `Professional-grade ${p.name.toLowerCase()} for clinical and home use. ISO certified with warranty.`,
        specifications: JSON.stringify(p.specs),
        sku: `JKR-${String(100 + i).padStart(4, '0')}`,
        regularPrice: p.regular,
        salePrice: onSale ? p.sale : null,
        onSale,
        stockQty: p.stock,
        inStock: p.stock > 0,
        categoryId: catMap[p.cat] || catMap['home-care'],
        brandId: brandMap[p.brand],
        isFeatured: p.featured || false,
        isExclusive: p.exclusive || false,
        metaTitle: `${p.name} | JKR International UAE`,
        metaDescription: `Buy ${p.name} in UAE. Premium medical equipment with warranty.`,
        ratingAvg: [4.6, 4.8, 4.9, 4.7, 5.0, 4.5][i % 6],
        ratingCount: [8, 15, 22, 6, 30, 12][i % 6],
        createdAt,
      },
    })

    await db.productImage.createMany({
      data: [
        { productId: product.id, imageUrl: medicalImg(i * 5 + 1), altText: p.name, sortOrder: 0, isPrimary: true },
        { productId: product.id, imageUrl: medicalImg(i * 5 + 2), altText: `${p.name} angle`, sortOrder: 1 },
        { productId: product.id, imageUrl: medicalImg(i * 5 + 3), altText: `${p.name} detail`, sortOrder: 2 },
      ],
    })

    // Add a couple reviews
    const reviewerNames = ['Dr. Omar F.', 'Layla M.', 'James K.', 'Aisha R.']
    for (let r = 0; r < 2; r++) {
      await db.productReview.create({
        data: {
          productId: product.id,
          authorName: reviewerNames[(i + r) % 4],
          rating: [5, 4][r],
          reviewText: ['Excellent product, highly recommend JKR International.', 'Great quality and fast delivery.'][r],
          isApproved: true,
        },
      })
    }

    if (p.exclusive) {
      await db.collectionProduct.create({ data: { collectionId: colMap['signature-series'], productId: product.id, sortOrder: 100 + i } })
    }
    if (p.featured) {
      await db.collectionProduct.create({ data: { collectionId: colMap['premium-collections'], productId: product.id, sortOrder: 100 + i } })
    }
    if (onSale) {
      await db.collectionProduct.create({ data: { collectionId: colMap['selected-offers'], productId: product.id, sortOrder: 100 + i } })
    }
  }

  const total = await db.product.count()
  console.log(`✅ Done! Total products now: ${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
