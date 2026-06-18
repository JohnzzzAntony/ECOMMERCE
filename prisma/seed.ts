// JKR International — Database seed script
// Run with: bun run prisma/seed.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const img = (q: string, seed: number, w = 800, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`

const medicalImg = (seed: number, w = 800, h = 800) =>
  `https://picsum.photos/seed/med${seed}/${w}/${h}`

async function main() {
  console.log('🌱 Seeding JKR International database...')

  // Clean
  await db.contactMessage.deleteMany()
  await db.newsletterSubscriber.deleteMany()
  await db.siteSettings.deleteMany()
  await db.galleryItem.deleteMany()
  await db.heroSlide.deleteMany()
  await db.clientLogo.deleteMany()
  await db.testimonial.deleteMany()
  await db.blogPost.deleteMany()
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.enquiry.deleteMany()
  await db.cartItem.deleteMany()
  await db.wishlistItem.deleteMany()
  await db.productReview.deleteMany()
  await db.productImage.deleteMany()
  await db.collectionProduct.deleteMany()
  await db.collection.deleteMany()
  await db.product.deleteMany()
  await db.brand.deleteMany()
  await db.category.deleteMany()
  await db.address.deleteMany()
  await db.user.deleteMany()

  // ─── Users ───
  const admin = await db.user.create({
    data: {
      email: 'admin@jkrinternational.com',
      password: 'admin123',
      firstName: 'JKR',
      lastName: 'Admin',
      phone: '+971 4 123 4567',
      role: 'admin',
    },
  })

  const customer = await db.user.create({
    data: {
      email: 'customer@example.com',
      password: 'customer123',
      firstName: 'Ahmed',
      lastName: 'Al-Rashidi',
      phone: '+971 50 123 4567',
      role: 'customer',
    },
  })

  // ─── Categories ───
  const categories = [
    { slug: 'wheelchairs', name: 'Wheelchairs', nameAr: 'الكراسي المتحركة', icon: 'AccessibleIcon', sortOrder: 1 },
    { slug: 'walking-aids', name: 'Walking Aids', nameAr: 'أدوات المشي', icon: 'Footprints', sortOrder: 2 },
    { slug: 'seating', name: 'Seating Systems', nameAr: 'أنظمة الجلوس', icon: 'Armchair', sortOrder: 3 },
    { slug: 'pressure-relief', name: 'Pressure Relief', nameAr: 'تخفيف الضغط', icon: 'ShieldCheck', sortOrder: 4 },
    { slug: 'physiotherapy', name: 'Physiotherapy', nameAr: 'العلاج الطبيعي', icon: 'Activity', sortOrder: 5 },
    { slug: 'orthopedic', name: 'Orthopedic', nameAr: 'تقويم العظام', icon: 'Bone', sortOrder: 6 },
    { slug: 'hospital-equipment', name: 'Hospital Equipment', nameAr: 'معدات المستشفيات', icon: 'Building2', sortOrder: 7 },
    { slug: 'home-care', name: 'Home Care', nameAr: 'الرعاية المنزلية', icon: 'Home', sortOrder: 8 },
    { slug: 'diagnostics', name: 'Diagnostics', nameAr: 'التشخيص', icon: 'Stethoscope', sortOrder: 9 },
    { slug: 'mobility', name: 'Mobility Solutions', nameAr: 'حلول التنقل', icon: 'Move', sortOrder: 10 },
    { slug: 'respiratory', name: 'Respiratory Care', nameAr: 'الرعاية التنفسية', icon: 'Wind', sortOrder: 11 },
    { slug: 'patient-handling', name: 'Patient Handling', nameAr: 'التعامل مع المرضى', icon: 'Users', sortOrder: 12 },
  ]

  const categoryMap: Record<string, string> = {}
  for (const c of categories) {
    const cat = await db.category.create({
      data: { ...c, imageUrl: medicalImg(categories.indexOf(c) + 1, 600, 600) },
    })
    categoryMap[c.slug] = cat.id
  }

  // Subcategories under wheelchairs
  const subcats = [
    { slug: 'active-wheelchairs', name: 'Active Wheelchairs', parent: 'wheelchairs' },
    { slug: 'bariatric-wheelchairs', name: 'Bariatric Wheelchairs', parent: 'wheelchairs' },
    { slug: 'pediatric-wheelchairs', name: 'Pediatric Wheelchairs', parent: 'wheelchairs' },
    { slug: 'power-wheelchairs', name: 'Power Wheelchairs', parent: 'wheelchairs' },
    { slug: 'transfer-boards', name: 'Transfer Boards', parent: 'wheelchairs' },
  ]
  for (const s of subcats) {
    const created = await db.category.create({
      data: {
        slug: s.slug,
        name: s.name,
        nameAr: s.name,
        parentId: categoryMap[s.parent],
        imageUrl: medicalImg(100 + subcats.indexOf(s), 600, 600),
        sortOrder: subcats.indexOf(s) + 1,
      },
    })
    categoryMap[s.slug] = created.id
  }

  // ─── Brands ───
  const brands = [
    { slug: 'dynarex', name: 'Dynarex', desc: 'Premium medical supplies manufacturer known for quality disposable and durable medical equipment.' },
    { slug: 'kirton', name: 'Kirton', desc: 'Specialist seating manufacturer providing postural support solutions for over 40 years.' },
    { slug: 'sissel', name: 'Sissel', desc: 'Swedish manufacturer of physiotherapy and pressure relief products.' },
    { slug: 'drive-devilbiss', name: 'Drive Devilbiss', desc: 'Global leader in durable medical equipment and mobility solutions.' },
    { slug: 'invacare', name: 'Invacare', desc: 'World-leading manufacturer of home and long-term care medical products.' },
    { slug: 'karma', name: 'Karma Medical', desc: 'Innovative wheelchair and mobility device manufacturer.' },
    { slug: 'ottobock', name: 'Ottobock', desc: 'Global leader in medical technology for mobility and independence.' },
    { slug: 'hill-rom', name: 'Hill-Rom', desc: 'Hospital bed and patient monitoring equipment specialist.' },
    { slug: 'philips', name: 'Philips Healthcare', desc: 'Diagnostic imaging and patient monitoring solutions.' },
    { slug: 'medline', name: 'Medline', desc: 'Comprehensive medical supplies and equipment distributor.' },
  ]
  const brandMap: Record<string, string> = {}
  for (const b of brands) {
    const brand = await db.brand.create({
      data: { slug: b.slug, name: b.name, description: b.desc, logoUrl: `https://picsum.photos/seed/brand-${b.slug}/200/80`, isActive: true },
    })
    brandMap[b.slug] = brand.id
  }

  // ─── Collections ───
  const collections = [
    { slug: 'premium-collections', name: 'Premium Collections', nameAr: 'المجموعات المتميزة', desc: 'Curated selection of premium healthcare equipment' },
    { slug: 'selected-offers', name: 'Selected Offers', nameAr: 'عروض مختارة', desc: 'Special offers on top medical equipment' },
    { slug: 'signature-series', name: 'Signature Series', nameAr: 'السلسلة المميزة', desc: 'Our signature line of exclusive products' },
  ]
  const collectionMap: Record<string, string> = {}
  for (const col of collections) {
    const c = await db.collection.create({
      data: { slug: col.slug, name: col.name, nameAr: col.nameAr, description: col.desc, bannerImageUrl: medicalImg(200 + collections.indexOf(col), 1600, 400), isActive: true, sortOrder: collections.indexOf(col) + 1 },
    })
    collectionMap[col.slug] = c.id
  }

  // ─── Products ───
  const productsData = [
    // Wheelchairs
    { slug: 'karma-precision-active-wheelchair', name: 'Karma Precision Active Wheelchair', cat: 'active-wheelchairs', brand: 'karma', regular: 12500, sale: 11200, stock: 8, featured: true, exclusive: true, specs: { 'Weight Capacity': '120 kg', 'Seat Width': '38/42 cm', 'Frame': 'Aluminum', 'Weight': '13.5 kg', 'Foldable': 'Yes' } },
    { slug: 'invacare-bariatric-heavy-duty-wheelchair', name: 'Invacare Bariatric Heavy Duty Wheelchair', cat: 'bariatric-wheelchairs', brand: 'invacare', regular: 8900, sale: 7990, stock: 5, featured: true, specs: { 'Weight Capacity': '225 kg', 'Seat Width': '55 cm', 'Frame': 'Reinforced Steel', 'Weight': '27 kg', 'Foldable': 'Yes' } },
    { slug: 'kirton-pediatric-postural-wheelchair', name: 'Kirton Pediatric Postural Wheelchair', cat: 'pediatric-wheelchairs', brand: 'kirton', regular: 15600, sale: null, stock: 3, exclusive: true, specs: { 'Weight Capacity': '45 kg', 'Seat Width': '30 cm', 'Frame': 'Aluminum', 'Growth Adjustable': 'Yes', 'Postural Support': 'Multi-point' } },
    { slug: 'drive-power-electric-wheelchair', name: 'Drive Power Electric Wheelchair', cat: 'power-wheelchairs', brand: 'drive-devilbiss', regular: 18500, sale: 16700, stock: 4, featured: true, specs: { 'Weight Capacity': '136 kg', 'Range': '25 km', 'Battery': 'Lithium 12Ah', 'Max Speed': '6 km/h', 'Foldable': 'Yes' } },
    { slug: 'premium-transfer-board', name: 'Premium Transfer Board', cat: 'transfer-boards', brand: 'dynarex', regular: 5600, sale: 5000, stock: 24, featured: true, exclusive: true, specs: { 'Length': '70 cm', 'Material': 'Birch Wood', 'Weight Capacity': '180 kg', 'Surface': 'Coated', 'Washable': 'Yes' } },
    { slug: 'karma-folding-transit-wheelchair', name: 'Karma Folding Transit Wheelchair', cat: 'wheelchairs', brand: 'karma', regular: 4200, sale: 3780, stock: 15, specs: { 'Weight Capacity': '100 kg', 'Seat Width': '41 cm', 'Weight': '12 kg', 'Foldable': 'Yes', 'Attendant Brakes': 'Yes' } },
    { slug: 'invacare-lightweight-self-propel', name: 'Invacare Lightweight Self-Propel Wheelchair', cat: 'wheelchairs', brand: 'invacare', regular: 6800, sale: null, stock: 10, specs: { 'Weight Capacity': '125 kg', 'Seat Width': '43 cm', 'Weight': '14 kg', 'Foldable': 'Yes', 'Quick Release Wheels': 'Yes' } },

    // Walking Aids
    { slug: 'adjustable-aluminum-walker', name: 'Adjustable Aluminum Walker', cat: 'walking-aids', brand: 'drive-devilbiss', regular: 850, sale: 690, stock: 40, featured: true, specs: { 'Height Adjustment': '78-96 cm', 'Material': 'Aluminum', 'Weight Capacity': '136 kg', 'Width': '56 cm', 'Foldable': 'Yes' } },
    { slug: 'ergonomic-forearm-crutch-pair', name: 'Ergonomic Forearm Crutch (Pair)', cat: 'walking-aids', brand: 'invacare', regular: 520, sale: null, stock: 50, specs: { 'Height Adjustment': '71-97 cm', 'Material': 'Aluminum', 'Weight Capacity': '136 kg', 'Cuff': 'Vinyon', 'Tip': 'Rubber' } },
    { slug: 'folding-cane-seat', name: 'Folding Cane Seat', cat: 'walking-aids', brand: 'medline', regular: 380, sale: 320, stock: 35, specs: { 'Height': '86 cm', 'Seat Diameter': '20 cm', 'Material': 'Aluminum', 'Weight Capacity': '100 kg', 'Foldable': 'Yes' } },
    { slug: 'rollator-walker-with-seat', name: 'Rollator Walker with Seat', cat: 'walking-aids', brand: 'drive-devilbiss', regular: 1450, sale: 1290, stock: 22, featured: true, specs: { 'Seat Height': '56 cm', 'Weight Capacity': '136 kg', 'Wheels': '4×6 inch', 'Brakes': 'Loop', 'Basket': 'Included' } },

    // Seating
    { slug: 'kirton-postural-care-chair', name: 'Kirton Postural Care Chair', cat: 'seating', brand: 'kirton', regular: 11200, sale: 9800, stock: 6, featured: true, exclusive: true, specs: { 'Weight Capacity': '120 kg', 'Tilt-in-Space': 'Yes', 'Recline': 'Yes', 'Adjustable': 'Multi-point', 'Upholstery': 'Pressure-relieving' } },
    { slug: 'high-back-orthopedic-chair', name: 'High Back Orthopedic Chair', cat: 'seating', brand: 'invacare', regular: 3400, sale: null, stock: 12, specs: { 'Seat Height': '45 cm', 'Weight Capacity': '120 kg', 'Adjustable': 'Height & Tilt', 'Material': 'Steel Frame', 'Cushion': 'High-density foam' } },
    { slug: 'shower-commode-chair', name: 'Shower Commode Chair', cat: 'seating', brand: 'drive-devilbiss', regular: 1850, sale: 1590, stock: 18, specs: { 'Material': 'Aluminum', 'Weight Capacity': '136 kg', 'Wheels': '4×3 inch casters', 'Waterproof': 'Yes', 'Bucket': 'Included' } },

    // Pressure Relief
    { slug: 'sissel-pressure-relief-cushion', name: 'Sissel Pressure Relief Cushion', cat: 'pressure-relief', brand: 'sissel', regular: 1200, sale: 990, stock: 30, featured: true, specs: { 'Size': '40×40 cm', 'Material': 'Memory Foam', 'Weight Capacity': '120 kg', 'Cover': 'Waterproof', 'Washable': 'Yes' } },
    { slug: 'alternating-pressure-mattress', name: 'Alternating Pressure Mattress', cat: 'pressure-relief', brand: 'invacare', regular: 4500, sale: 3950, stock: 8, featured: true, specs: { 'Size': '200×90 cm', 'Cells': '20', 'Pump': 'Adjustable', 'Cycle Time': '10 min', 'Weight Capacity': '140 kg' } },
    { slug: 'heel-protector-pair', name: 'Heel Protector Pair', cat: 'pressure-relief', brand: 'dynarex', regular: 280, sale: null, stock: 60, specs: { 'Material': 'Synthetic fleece', 'Size': 'Universal', 'Adjustable': 'Velcro', 'Washable': 'Yes', 'Pair': 'Yes' } },

    // Physiotherapy
    { slug: 'sissel-exercise-ball-65cm', name: 'Sissel Exercise Ball 65cm', cat: 'physiotherapy', brand: 'sissel', regular: 240, sale: 199, stock: 80, specs: { 'Diameter': '65 cm', 'Material': 'PVC', 'Burst Resistant': 'Yes', 'Weight Capacity': '300 kg', 'Color': 'Teal' } },
    { slug: 'resistance-band-set', name: 'Resistance Band Set (5 pcs)', cat: 'physiotherapy', brand: 'medline', regular: 180, sale: null, stock: 100, specs: { 'Pieces': '5', 'Resistance Levels': 'X-Light to X-Heavy', 'Material': 'Latex', 'Length': '1.5 m', 'Includes': 'Carry bag' } },
    { slug: 'ultrasound-therapy-unit', name: 'Ultrasound Therapy Unit', cat: 'physiotherapy', brand: 'philips', regular: 9800, sale: 8400, stock: 4, featured: true, exclusive: true, specs: { 'Frequency': '1/3 MHz', 'Output': '0-3 W/cm²', 'Modes': 'Continuous/Pulsed', 'Display': 'LCD', 'Heads': '2 included' } },

    // Orthopedic
    { slug: 'knee-immobilizer-brace', name: 'Knee Immobilizer Brace', cat: 'orthopedic', brand: 'ottobock', regular: 680, sale: 560, stock: 28, specs: { 'Length': '60 cm', 'Size': 'Universal', 'Material': 'Neoprene', 'Supports': '3 Aluminum stays', 'Washable': 'Yes' } },
    { slug: 'cervical-collar-soft', name: 'Cervical Collar (Soft)', cat: 'orthopedic', brand: 'dynarex', regular: 95, sale: null, stock: 120, specs: { 'Sizes': 'S/M/L', 'Material': 'Foam', 'Closure': 'Velcro', 'Washable': 'Yes', 'Latex Free': 'Yes' } },
    { slug: 'lumbar-support-belt', name: 'Lumbar Support Belt', cat: 'orthopedic', brand: 'invacare', regular: 320, sale: 270, stock: 45, specs: { 'Sizes': 'S-XXL', 'Material': 'Elastic + Stays', 'Support': 'Dual adjustment', 'Breathable': 'Yes', 'Washable': 'Yes' } },

    // Hospital Equipment
    { slug: 'hill-rom-electric-hospital-bed', name: 'Hill-Rom Electric Hospital Bed', cat: 'hospital-equipment', brand: 'hill-rom', regular: 22000, sale: 19800, stock: 3, featured: true, exclusive: true, specs: { 'Functions': 'Hi-Lo, Head, Knee', 'Weight Capacity': '227 kg', 'Side Rails': 'Yes', 'Surface': 'Mattress included', 'Power': 'Electric' } },
    { slug: 'manual-patient-bed', name: 'Manual Patient Bed', cat: 'hospital-equipment', brand: 'medline', regular: 6500, sale: null, stock: 9, specs: { 'Functions': 'Head, Knee (manual)', 'Weight Capacity': '150 kg', 'Side Rails': 'Yes', 'Material': 'Steel', 'Wheels': '4 casters' } },
    { slug: 'iv-stand-deluxe', name: 'IV Stand Deluxe', cat: 'hospital-equipment', brand: 'medline', regular: 450, sale: 380, stock: 25, specs: { 'Height': 'Adjustable 110-210 cm', 'Base': '5-leg', 'Casters': 'Yes', 'Hooks': '4', 'Material': 'Chrome steel' } },
    { slug: 'surgical-examination-light', name: 'Surgical Examination Light', cat: 'hospital-equipment', brand: 'philips', regular: 3800, sale: 3200, stock: 7, featured: true, specs: { 'Illumination': '40,000 lux', 'Color Temp': '4500K', 'LED': 'Yes', 'Adjustable': 'Arm', 'Mount': 'Wall/Ceiling' } },

    // Home Care
    { slug: 'oxygen-concentrator-5l', name: 'Oxygen Concentrator 5L', cat: 'home-care', brand: 'philips', regular: 5400, sale: 4850, stock: 6, featured: true, specs: { 'Flow Rate': '0-5 L/min', 'Purity': '93%±3%', 'Power': '300W', 'Weight': '16 kg', 'Alarm': 'Yes' } },
    { slug: 'hospital-bed-over-bed-table', name: 'Overbed Hospital Table', cat: 'home-care', brand: 'drive-devilbiss', regular: 980, sale: null, stock: 20, specs: { 'Tabletop': '60×40 cm', 'Height': 'Adjustable', 'Tilt': 'Yes', 'Casters': '4', 'Weight Capacity': '25 kg' } },
    { slug: 'bed-pan-rail-assist', name: 'Bed Rail Assist Bar', cat: 'home-care', brand: 'invacare', regular: 540, sale: 450, stock: 30, specs: { 'Adjustable': 'Yes', 'Weight Capacity': '136 kg', 'Installation': 'Tool-free', 'Material': 'Steel', 'Fits Beds': 'Twin-Queen' } },
    { slug: 'patient-lift-hoist', name: 'Patient Lift Hoist', cat: 'home-care', brand: 'invacare', regular: 7800, sale: 6900, stock: 5, featured: true, specs: { 'Weight Capacity': '180 kg', 'Power': 'Hydraulic', 'Base': 'Adjustable', 'Sling': 'Included', 'Wheels': '4 casters' } },

    // Diagnostics
    { slug: 'digital-blood-pressure-monitor', name: 'Digital Blood Pressure Monitor', cat: 'diagnostics', brand: 'philips', regular: 380, sale: 320, stock: 50, featured: true, specs: { 'Type': 'Upper arm', 'Display': 'LCD', 'Memory': '90 readings', 'Power': 'AA + AC', 'Cuff': '22-42 cm' } },
    { slug: 'pulse-oximeter-fingertip', name: 'Pulse Oximeter Fingertip', cat: 'diagnostics', brand: 'medline', regular: 120, sale: 95, stock: 200, specs: { 'Display': 'OLED', 'Measurement': 'SpO2 & PR', 'Power': '2×AAA', 'Auto-off': 'Yes', 'Lanyard': 'Included' } },
    { slug: 'infrared-thermometer', name: 'Infrared Thermometer', cat: 'diagnostics', brand: 'philips', regular: 180, sale: null, stock: 150, specs: { 'Measurement': 'Forehead/Ear', 'Range': '32-42.9°C', 'Accuracy': '±0.2°C', 'Memory': '35 readings', 'Color Alarm': 'Yes' } },
    { slug: 'stethoscope-dual-head', name: 'Stethoscope Dual Head', cat: 'diagnostics', brand: 'medline', regular: 240, sale: 199, stock: 70, specs: { 'Chestpiece': 'Dual head', 'Tube': '22 inch', 'Material': 'Stainless steel', 'Eartips': '3 sizes', 'Diaphragm': 'Non-chill' } },

    // Mobility
    { slug: 'mobility-scooter-folding', name: 'Folding Mobility Scooter', cat: 'mobility', brand: 'karma', regular: 9500, sale: 8200, stock: 4, featured: true, exclusive: true, specs: { 'Weight Capacity': '136 kg', 'Range': '16 km', 'Max Speed': '6 km/h', 'Weight': '26 kg', 'Foldable': 'Yes' } },
    { slug: 'patient-transfer-hoist-sling', name: 'Patient Transfer Sling', cat: 'mobility', brand: 'invacare', regular: 680, sale: null, stock: 18, specs: { 'Type': 'Universal', 'Material': 'Polyester', 'Weight Capacity': '180 kg', 'Washable': 'Yes', 'Sizes': 'S-XL' } },

    // Respiratory
    { slug: 'nebulizer-compressor', name: 'Nebulizer Compressor', cat: 'respiratory', brand: 'philips', regular: 420, sale: 350, stock: 40, specs: { 'Type': 'Compressor', 'Particle Size': '0.5-5 micron', 'Medication Cup': '8 ml', 'Power': 'AC', 'Mask': 'Adult+Child' } },
    { slug: 'cpap-machine-auto', name: 'CPAP Machine Auto', cat: 'respiratory', brand: 'philips', regular: 4800, sale: 4250, stock: 8, featured: true, specs: { 'Mode': 'APAP', 'Pressure': '4-20 cmH2O', 'Display': 'LCD', 'Humidifier': 'Included', 'Data': 'SD card' } },

    // Patient Handling
    { slug: 'patient-transfer-board-angled', name: 'Angled Patient Transfer Board', cat: 'patient-handling', brand: 'dynarex', regular: 720, sale: null, stock: 22, specs: { 'Length': '60 cm', 'Material': 'HDPE', 'Weight Capacity': '180 kg', 'Shape': 'Angled', 'Washable': 'Yes' } },
    { slug: 'slide-sheet-pair', name: 'Slide Sheet Pair', cat: 'patient-handling', brand: 'medline', regular: 180, sale: 145, stock: 80, specs: { 'Size': '140×70 cm', 'Material': 'Silicone-coated nylon', 'Weight Capacity': '180 kg', 'Quantity': '2', 'Washable': 'Yes' } },
  ]

  const productSlugs: { slug: string; id: string; price: number; sale: number | null }[] = []
  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i]
    const onSale = p.sale !== null && p.sale !== undefined
    const effectivePrice = onSale ? p.sale! : p.regular
    const discountPercent = onSale ? Math.round(((p.regular - p.sale!) / p.regular) * 100) : 0
    const product = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        nameAr: p.name,
        description: `The ${p.name} is a premium medical equipment product from JKR International, designed and manufactured to the highest healthcare standards. Trusted by hospitals, clinics, and home-care providers across the UAE.\n\nThis product is sourced from globally certified manufacturers and meets ISO 9001 quality standards. Our expert team in Dubai and Abu Dhabi provides full after-sales support, installation, and training.\n\nKey benefits include durability, ergonomic design, and compliance with international medical equipment regulations. Available with warranty and maintenance plans.`,
        descriptionAr: p.name,
        shortDescription: `Professional-grade ${p.name.toLowerCase()} for clinical and home use. ISO certified with full warranty.`,
        specifications: JSON.stringify(p.specs),
        sku: `JKR-${String(i + 1).padStart(4, '0')}`,
        barcode: `628${String(1000000 + i).padStart(7, '0')}`,
        regularPrice: p.regular,
        salePrice: onSale ? p.sale : null,
        onSale,
        stockQty: p.stock,
        inStock: p.stock > 0,
        categoryId: categoryMap[p.cat] || categoryMap['wheelchairs'],
        brandId: brandMap[p.brand],
        isFeatured: p.featured || false,
        isExclusive: p.exclusive || false,
        metaTitle: `${p.name} | JKR International UAE`,
        metaDescription: `Buy ${p.name} in UAE. Premium medical equipment with warranty. Dubai & Abu Dhabi delivery.`,
        metaKeywords: `${p.name}, medical equipment UAE, ${p.brand}`,
        ratingAvg: [4.5, 4.7, 4.8, 4.9, 4.6, 5.0, 4.4][i % 7],
        ratingCount: [12, 28, 5, 50, 8, 34, 18][i % 7],
      },
    })
    productSlugs.push({ slug: p.slug, id: product.id, price: p.regular, sale: p.sale })

    // Primary image + 2-3 extra images
    await db.productImage.createMany({
      data: [
        { productId: product.id, imageUrl: medicalImg(i * 10 + 1), altText: p.name, sortOrder: 0, isPrimary: true },
        { productId: product.id, imageUrl: medicalImg(i * 10 + 2), altText: `${p.name} side view`, sortOrder: 1 },
        { productId: product.id, imageUrl: medicalImg(i * 10 + 3), altText: `${p.name} detail`, sortOrder: 2 },
        { productId: product.id, imageUrl: medicalImg(i * 10 + 4), altText: `${p.name} in use`, sortOrder: 3 },
      ],
    })

    // Reviews
    const reviewCount = (i % 3) + 2
    const reviewerNames = ['Ahmed M.', 'Sarah J.', 'Dr. Khalid', 'Fatima A.', 'Mohammed R.', 'Layla H.', 'Omar S.', 'Noura K.']
    const reviewTexts = [
      'Excellent product, exactly as described. Delivery was prompt and the team was very professional.',
      'High quality medical equipment. We use it daily in our clinic. Highly recommend JKR International.',
      'Great value for money. The installation team was knowledgeable and helpful.',
      'Been using for 3 months now, very durable and well-built. Worth the investment.',
      'Top-notch customer service and product quality. Will purchase again from JKR.',
      'Perfect for our home care needs. Easy to use and maintain.',
    ]
    for (let r = 0; r < reviewCount; r++) {
      await db.productReview.create({
        data: {
          productId: product.id,
          userId: customer.id,
          authorName: reviewerNames[(i + r) % reviewerNames.length],
          rating: [5, 4, 5, 5, 4, 5][r % 6],
          reviewText: reviewTexts[(i + r) % reviewTexts.length],
          isApproved: true,
        },
      })
    }

    // Assign to collections
    if (p.exclusive) {
      await db.collectionProduct.create({ data: { collectionId: collectionMap['signature-series'], productId: product.id, sortOrder: i } })
    }
    if (p.featured) {
      await db.collectionProduct.create({ data: { collectionId: collectionMap['premium-collections'], productId: product.id, sortOrder: i } })
    }
    if (onSale) {
      await db.collectionProduct.create({ data: { collectionId: collectionMap['selected-offers'], productId: product.id, sortOrder: i } })
    }
  }

  // ─── Blog Posts ───
  const posts = [
    { slug: 'choosing-right-wheelchair-guide', title: 'How to Choose the Right Wheelchair: A Complete Guide', category: 'Buying Guides', excerpt: 'Selecting the right wheelchair can dramatically improve quality of life. Here is what to consider.', content: 'Choosing a wheelchair is a significant decision that impacts mobility, comfort, and independence. In this comprehensive guide, we walk you through the key factors...\n\n## Understanding Wheelchair Types\n\nThere are several categories including manual, power, and bariatric wheelchairs. Each serves different needs.\n\n## Key Considerations\n\n1. **Weight Capacity** — Ensure the chair supports the user weight comfortably\n2. **Seat Width** — Measure hip width plus 5cm\n3. **Usage Environment** — Indoor vs outdoor\n4. **Portability** — Foldable for travel\n5. **Postural Support** — Especially for long-term users\n\n## Professional Assessment\n\nWe recommend a professional assessment from our team. Visit our Dubai or Abu Dhabi showroom.\n\n## Conclusion\n\nThe right wheelchair transforms daily life. Contact JKR International for a personalized consultation.' },
    { slug: 'pressure-injury-prevention', title: 'Pressure Injury Prevention: Best Practices for Caregivers', category: 'Healthcare Tips', excerpt: 'Pressure injuries affect millions. Learn evidence-based prevention strategies.', content: 'Pressure injuries (also called bedsores) are a serious concern for immobile patients...\n\n## Understanding Pressure Injuries\n\nThey develop when sustained pressure reduces blood flow to skin and tissue.\n\n## Risk Factors\n\n- Immobility\n- Poor nutrition\n- Moisture\n- Reduced sensation\n\n## Prevention Strategies\n\n1. **Reposition every 2 hours**\n2. **Use pressure-relieving mattresses**\n3. **Keep skin clean and dry**\n4. **Ensure adequate nutrition**\n\n## Equipment That Helps\n\nAlternating pressure mattresses and pressure-relief cushions from Sissel and Invacare are proven solutions.' },
    { slug: 'home-care-setup-checklist', title: 'Essential Home Care Setup Checklist for Seniors', category: 'Home Care', excerpt: 'Transform any home into a safe, accessible environment for elderly care.', content: 'Setting up a home for senior care requires thoughtful planning...\n\n## Bathroom Safety\n\nInstall grab bars, raised toilet seats, and shower chairs.\n\n## Bedroom Comfort\n\nHospital beds, overbed tables, and bed rails improve comfort and safety.\n\n## Mobility Aids\n\nWalkers, canes, and transfer boards maintain independence.\n\n## Monitoring\n\nBlood pressure monitors and pulse oximeters enable proactive health tracking.' },
    { slug: 'understanding-oxygen-therapy', title: 'Understanding Oxygen Therapy at Home', category: 'Respiratory Care', excerpt: 'A guide to home oxygen therapy equipment and safety.', content: 'Home oxygen therapy helps patients with respiratory conditions...\n\n## Types of Equipment\n\n- Oxygen concentrators\n- CPAP machines\n- Nebulizers\n\n## Safety Considerations\n\nKeep away from open flames, ensure proper ventilation, and follow prescription guidelines.' },
    { slug: 'physiotherapy-recovery-tips', title: '5 Physiotherapy Exercises for Faster Recovery', category: 'Rehabilitation', excerpt: 'Evidence-based exercises to accelerate healing after injury or surgery.', content: 'Recovery from injury requires consistent, guided exercise...\n\n## Exercise 1: Ankle Pumps\n\nImprove circulation after surgery.\n\n## Exercise 2: Quadr Sets\n\nStrengthen thigh muscles.\n\n## Exercise 3: Glute Bridges\n\nBuild core and glute strength.\n\n## Exercise 4: Resistance Band Rows\n\nImprove posture and back strength.\n\n## Exercise 5: Balance Work\n\nUse exercise balls for stability training.' },
    { slug: 'medical-equipment-maintenance', title: 'Medical Equipment Maintenance: Extending Lifespan', category: 'Maintenance', excerpt: 'Proper maintenance keeps your medical equipment performing optimally for years.', content: 'Regular maintenance is essential for medical equipment reliability...\n\n## Daily Care\n\nClean surfaces, check batteries, inspect for wear.\n\n## Monthly Tasks\n\nDeep clean, calibrate, replace filters.\n\n## Annual Service\n\nProfessional servicing by JKR technicians ensures warranty compliance.' },
  ]
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
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
        coverImageUrl: medicalImg(500 + i, 1200, 600),
        isPublished: true,
        publishedAt: new Date(Date.now() - i * 86400000 * 3),
        metaTitle: p.title,
        metaDescription: p.excerpt,
      },
    })
  }

  // ─── Testimonials ───
  const testimonials = [
    { name: 'Dr. Khalid Mansour', role: 'Chief of Rehabilitation, Dubai Hospital', content: 'JKR International has been our trusted supplier for over 5 years. Their product quality and after-sales service are unmatched in the UAE market.', rating: 5 },
    { name: 'Sarah Johnson', role: 'Director, Al Noor Care Home, Abu Dhabi', content: 'The team helped us equip our entire facility. Professional, knowledgeable, and always available for support. Highly recommended.', rating: 5 },
    { name: 'Ahmed Al-Rashidi', role: 'Home Care Patient Family', content: 'When my father needed a hospital bed at home, JKR guided us through every step. The delivery and installation were seamless.', rating: 5 },
    { name: 'Dr. Layla Hassan', role: 'Physiotherapist, Saudi German Hospital', content: 'Their physiotherapy equipment range is excellent. The ultrasound therapy unit we purchased has been reliable and precise.', rating: 5 },
    { name: 'Mohammed Rahman', role: 'Procurement Manager, Mediclinic', content: 'Bulk ordering is smooth and pricing is competitive. JKR understands the B2B medical procurement process well.', rating: 5 },
    { name: 'Noura Al-Zaabi', role: 'Clinic Owner, Sharjah', content: 'From examination lights to diagnostic tools, everything we bought from JKR has exceeded expectations. Great warranty support too.', rating: 5 },
  ]
  for (let i = 0; i < testimonials.length; i++) {
    await db.testimonial.create({
      data: { ...testimonials[i], avatarUrl: `https://i.pravatar.cc/150?img=${i + 11}`, sortOrder: i, isActive: true },
    })
  }

  // ─── Client Logos (Partners) ───
  const clients = [
    'Dubai Hospital', 'Saudi German Hospital', 'Mediclinic', 'Aster DM Healthcare', 'NMC Healthcare', 'Al Noor Hospital', 'Sheikh Khalifa Medical City', 'Cleveland Clinic Abu Dhabi', 'Burjeel Hospital', 'Emirates Hospital',
  ]
  for (let i = 0; i < clients.length; i++) {
    await db.clientLogo.create({
      data: { name: clients[i], logoUrl: `https://picsum.photos/seed/client${i}/180/60`, websiteUrl: '#', sortOrder: i, isActive: true },
    })
  }

  // ─── Hero Slides ───
  const slides = [
    { title: 'State-of-the-art diagnostic instruments from globally certified manufacturers', subtitle: 'Premium Medical Equipment', ctaLabel: 'Shop Now', ctaUrl: 'products' },
    { title: 'Rehabilitation & mobility solutions tailored to every patient need', subtitle: 'Mobility & Rehab', ctaLabel: 'View Catalog', ctaUrl: 'products' },
    { title: 'Exclusive offers on selected medical equipment — limited time only', subtitle: 'Special Offers', ctaLabel: 'View Offers', ctaUrl: 'products' },
    { title: 'Trusted by 500+ hospitals & clinics across the UAE', subtitle: 'Healthcare Partner', ctaLabel: 'About Us', ctaUrl: 'about' },
  ]
  for (let i = 0; i < slides.length; i++) {
    await db.heroSlide.create({
      data: { ...slides[i], imageUrl: medicalImg(700 + i, 1920, 700), sortOrder: i, isActive: true },
    })
  }

  // ─── Gallery ───
  const galleryCats = ['Showroom', 'Events', 'Products', 'Team']
  for (let i = 0; i < 12; i++) {
    await db.galleryItem.create({
      data: {
        imageUrl: medicalImg(800 + i, 600, 600),
        caption: `${galleryCats[i % 4]} - ${i + 1}`,
        category: galleryCats[i % 4],
        sortOrder: i,
        isActive: true,
      },
    })
  }

  // ─── Site Settings ───
  const settings: [string, string][] = [
    ['site_name', 'JKR International'],
    ['tagline', 'Delivering world-class medical equipment across the UAE'],
    ['phone_dubai', '+971 4 123 4567'],
    ['phone_abudhabi', '+971 2 765 4321'],
    ['whatsapp', '+971501234567'],
    ['email', 'info@jkrinternational.com'],
    ['address_dubai', 'Office No.2, Lootah Building, Business Bay, Dubai, UAE'],
    ['address_abudhabi', 'Al Fardan Holdings Building, Hamdan Street, Abu Dhabi, UAE'],
    ['instagram_url', 'https://instagram.com/jkrinternational'],
    ['facebook_url', 'https://facebook.com/jkrinternational'],
    ['twitter_url', 'https://twitter.com/jkrinternational'],
    ['linkedin_url', 'https://linkedin.com/company/jkrinternational'],
    ['free_delivery_threshold', '2000'],
    ['top_bar_announcement', 'Free UAE Delivery on Purchases Above AED 2,000'],
    ['instagram_handle', '@jkrinternational'],
    ['hours_dubai', 'Sat-Thu: 9:00 AM - 7:00 PM'],
    ['hours_abudhabi', 'Sat-Thu: 9:00 AM - 6:00 PM'],
  ]
  for (const [key, value] of settings) {
    await db.siteSettings.create({ data: { key, value } })
  }

  // ─── Sample Order ───
  const transferBoard = productSlugs.find(p => p.slug === 'premium-transfer-board')!
  const commode = productSlugs.find(p => p.slug === 'shower-commode-chair')!
  const order = await db.order.create({
    data: {
      orderNumber: 'JKR-ORD-001',
      userId: customer.id,
      customerName: 'Ahmed Al-Rashidi',
      email: 'customer@example.com',
      phone: '+971 50 123 4567',
      billingAddress: JSON.stringify({ line1: 'Office No.2, Lootah Building', city: 'Dubai', emirate: 'Dubai', country: 'UAE' }),
      shippingAddress: JSON.stringify({ line1: 'Office No.2, Lootah Building', city: 'Dubai', emirate: 'Dubai', country: 'UAE' }),
      subtotal: transferBoard.sale! + commode.sale!,
      discount: 0,
      total: transferBoard.sale! + commode.sale!,
      paymentMethod: 'tabby',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
    },
  })
  await db.orderItem.createMany({
    data: [
      { orderId: order.id, productId: transferBoard.id, productName: 'Premium Transfer Board', sku: 'JKR-0005', unitPrice: transferBoard.sale!, qty: 1, subtotal: transferBoard.sale! },
      { orderId: order.id, productId: commode.id, productName: 'Shower Commode Chair', sku: 'JKR-0013', unitPrice: commode.sale!, qty: 1, subtotal: commode.sale! },
    ],
  })

  // ─── Sample Enquiry ───
  await db.enquiry.create({
    data: {
      customerName: 'Mohammed Rahman',
      email: 'mrahman@mediclinic.ae',
      phone: '+971 50 987 6543',
      company: 'Mediclinic',
      message: 'Need bulk pricing for 10 units.',
      status: 'new',
      itemsJson: JSON.stringify([{ name: 'Hill-Rom Electric Hospital Bed', qty: 10, price: 19800 }]),
      total: 198000,
    },
  })

  console.log(`✅ Seed complete!`)
  console.log(`   - ${productsData.length} products`)
  console.log(`   - ${posts.length} blog posts`)
  console.log(`   - ${testimonials.length} testimonials`)
  console.log(`   - ${clients.length} client logos`)
  console.log(`   - Admin login: admin@jkrinternational.com / admin123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
