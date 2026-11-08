// Installs the starter theme and catalog without replacing existing content.
import { PrismaClient } from '@prisma/client'
import { DEFAULT_MENUS } from '../src/shared/theme'
import { OMBRINE_SCHEMA } from '../src/shared/ombrine'

const products = [
  ['satin-dress', 'Ruby satin mini dress', 890, 'XS, S, M, L', 'Bias-cut satin, draped through the neckline.'],
  ['suede-jacket', 'Rust suede jacket', 1280, 'S, M, L, XL', 'Supple tobacco suede with a clean, cropped profile.'],
  ['leather-jacket', 'Black leather jacket', 1690, 'S, M, L, XL', 'Soft black leather, cut to sit just below the waist.'],
  ['silk-blouse', 'Silk bow blouse', 1190, '34, 36, 38, 40, 42, 44', 'Fluid oxblood silk with a softly tied neckline.'],
  ['bias-satin-skirt', 'Bias satin skirt', 980, '34, 36, 38, 40, 42, 44', 'Black satin cut on the bias for a clean, moving silhouette.'],
  ['kitten-heel-slingback', 'Kitten-heel slingback', 690, '36, 37, 38, 39, 40, 41', 'Pointed black leather slingbacks with a low kitten heel.'],
  ['cable-crewneck', 'Cable cashmere crewneck', 1450, 'XS, S, M, L, XL', 'Hand-linked ivory cashmere with a soft, dimensional cable stitch.'],
  ['wide-trousers', 'Wide trousers', 760, '44, 46, 48, 50, 52, 54', 'Olive gabardine with a full leg and a natural break.'],
  ['suede-derby', 'Suede derby', 740, '40, 41, 42, 43, 44, 45, 46', 'Soft taupe suede with a rounded toe and a low stacked heel.'],
  ['pleated-skirt', 'Celeste pleated skirt', 690, 'XS, S, M, L', 'Light blue pleats with an airy sweep and a clean waist.'],
  ['wool-overcoat', 'Slate wool overcoat', 1580, 'XS, S, M, L', 'A long, grey wool coat with a generous lapel and an easy shoulder.'],
  ['double-breasted-jacket', 'Dune double-breasted jacket', 1190, '44, 46, 48, 50, 52, 54', 'Warm taupe tailoring with a softly structured double-breasted front.'],
] as const

const looks = [
  ['rouge', 'Rouge', 'Mina', 'Ruby satin after dark, with a cropped black jacket and a bare ankle.', ['satin-dress']],
  ['sienna', 'Sienna', 'Elias', 'Warm suede, ivory cotton and an easy shoulder.', ['suede-jacket']],
  ['noir', 'Noir', 'Ren', 'Polished black leather and pale trousers cut with room to move.', ['leather-jacket']],
  ['oxblood', 'Oxblood', 'Yuna', 'Oxblood silk and black satin, both cut to move. For evenings that start early.', ['silk-blouse', 'bias-satin-skirt', 'kitten-heel-slingback']],
  ['north-cable', 'North Cable', 'Theo', 'Hand-linked cashmere, olive gabardine and a soft suede derby. Made for long walks.', ['cable-crewneck', 'wide-trousers', 'suede-derby']],
  ['slate', 'Slate', 'Leila', 'Tonal grey tailoring with the weight and warmth of a long wool coat.', ['wool-overcoat']],
  ['celeste', 'Céleste', 'Clara', 'An ivory blouse and light blue pleats that catch the air.', ['pleated-skirt']],
  ['dune', 'Dune', 'Ari', 'A softly structured double-breasted suit in a warm shade of stone.', ['double-breasted-jacket']],
] as const

const categories = [
  ['outerwear', 'Outerwear', ['suede-jacket', 'leather-jacket', 'wool-overcoat']],
  ['knitwear', 'Knitwear', ['cable-crewneck']],
  ['tailoring', 'Tailoring', ['double-breasted-jacket']],
  ['trousers-and-skirts', 'Trousers and skirts', ['wide-trousers', 'bias-satin-skirt', 'pleated-skirt']],
  ['shoes', 'Shoes', ['suede-derby', 'kitten-heel-slingback']],
  ['dresses', 'Dresses', ['satin-dress']],
  ['blouses', 'Blouses', ['silk-blouse']],
] as const
const womenswear = new Set(['rouge', 'oxblood', 'slate', 'celeste'])
const salonCollections: Record<string, string> = { rouge: 'Evening', noir: 'Evening', oxblood: 'Evening', sienna: 'Tailoring', slate: 'Tailoring', dune: 'Tailoring', 'north-cable': 'Weekend', celeste: 'Weekend' }

const menus = {
  main: [
    { id: 'collection', label: 'Collection', link: '/collection' },
    { id: 'salon', label: 'Looks', link: '/looks' },
    { id: 'atelier', label: 'Atelier', link: '/atelier' },
    { id: 'journal', label: 'Journal', link: '/journal' },
  ],
  footer: [
    { id: 'atelier', label: 'Atelier', link: '/atelier' },
    { id: 'journal', label: 'Journal', link: '/journal' },
    { id: 'delivery', label: 'Delivery & returns', link: '/pages/ombrine-delivery' },
  ],
}
const editorial = [
  ['ombrine-atelier', 'Atelier', '<p>Ombrine brings the feel of a private fitting room into a digital salon. Explore full silhouettes, then step closer to see the materials and pieces that make each look.</p><h2>Cloth and construction</h2><p>The first edit pairs tactile cashmere, soft suede and fluid silk with easy tailoring.</p>'],
  ['ombrine-journal', 'Journal', '<h2>Notes from the first salon</h2><p>North Cable starts with an ivory crewneck. Wide olive trousers give the knit room, while a soft suede derby keeps the palette close to the earth.</p><p>Elsewhere in the salon, silk and pleats catch the light. The pieces are arranged as complete looks so you can see how they move together.</p>'],
  ['ombrine-delivery', 'Delivery & returns', '<p>Delivery and returns are complimentary for the salon collection. The delivery destinations available to your order appear at checkout.</p>'],
] as const

const databaseUrl = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) && !process.argv.includes('--allow-remote')) {
  throw new Error('The configured database is remote. Use an isolated database or explicitly pass --allow-remote.')
}
const db = new PrismaClient()
const image = (slug: string) => `/ombrine/${slug}.webp`
const activate = process.argv.includes('--activate')
try {
  const result = await db.$transaction(async (tx) => {
    const theme = await tx.theme.upsert({
      where: { slug: 'ombrine' }, update: { settingsSchema: JSON.stringify(OMBRINE_SCHEMA) },
      create: { slug: 'ombrine', name: 'Ombrine', kind: 'native', description: 'A warm editorial fashion salon with a shoppable spatial gallery.',
        settingsSchema: JSON.stringify(OMBRINE_SCHEMA),
        settings: JSON.stringify({ logo_text: 'NexEcoms', logo_tagline: '', color_background: '#ECE8E2', color_text: '#16130F', color_surface: '#F5F2ED', color_primary: '#16130F', color_primary_dark: '#100E0C', color_accent: '#6C6359', color_border: '#CCC4B8', show_announcement: false }),
      },
    })
    // Native theme administration is explicitly enabled for the existing legacy storefront.
    await tx.store.updateMany({
      where: { id: 'legacy', OR: [{ themesEnabled: false }, { themesEnabled: null }] },
      data: { themesEnabled: true },
    })
    const brand = await tx.brand.upsert({ where: { slug: 'ombrine' }, update: {}, create: { slug: 'ombrine', name: 'NexEcoms', description: 'The first salon collection.' } })
    await tx.productField.upsert({ where: { slug: 'ombrine-sizes' }, update: {}, create: { slug: 'ombrine-sizes', label: 'Available sizes (comma-separated)', showOnStorefront: false } })
    const ids = new Map<string, string>()
    for (const [key, name, regularPrice, sizes, shortDescription] of products) {
      const slug = `ombrine-${key}`
      const inStock = key !== 'wool-overcoat'
      const row = await tx.product.upsert({
        where: { slug }, update: {},
        create: { slug, name, sku: `OM-${key.toUpperCase()}`, regularPrice, shortDescription, brandId: brand.id, inStock, stockQty: inStock ? 12 : 0,
          isFeatured: key === 'cable-crewneck', attributes: JSON.stringify({ 'ombrine-sizes': sizes }),
          images: { create: { imageUrl: image(key), altText: name, isPrimary: true } },
        },
      })
      if (key === 'silk-blouse') {
        await tx.product.updateMany({
          where: { id: row.id, name: 'Oxblood silk blouse', regularPrice: 620, onSale: false },
          data: { name, regularPrice },
        })
        await tx.product.updateMany({
          where: { id: row.id, shortDescription: 'Fluid silk with a lightly shaped shoulder and an open collar.' },
          data: { shortDescription },
        })
        await tx.product.updateMany({
          where: { id: row.id, attributes: JSON.stringify({ 'ombrine-sizes': 'XS, S, M, L' }) },
          data: { attributes: JSON.stringify({ 'ombrine-sizes': sizes }) },
        })
      }
      ids.set(key, row.id)
    }
    for (const [sortOrder, [key, name, pieces]] of categories.entries()) {
      const slug = `ombrine-${key}`
      const category = await tx.category.upsert({ where: { slug }, update: {}, create: { slug, name, sortOrder } })
      await tx.product.updateMany({ where: { id: { in: pieces.map((piece) => ids.get(piece)!) }, categoryId: null }, data: { categoryId: category.id } })
    }
    for (const [sortOrder, [key, name, modelName, description, pieces]] of looks.entries()) {
      const id = `ombrine-${key}`
      const items = JSON.stringify(pieces.map((piece, i) => ({ productId: ids.get(piece)!, x: 50, y: [30, 62, 95][i] })))
      const audience = womenswear.has(key) ? 'women' : 'men'
      await tx.look.upsert({ where: { id }, update: {}, create: { id, name, modelName, description, audience, imageUrl: image(key), sortOrder, items } })
      await tx.look.updateMany({ where: { id, audience: null }, data: { audience } })
      await tx.look.updateMany({ where: { id, collection: null }, data: { collection: salonCollections[key] } })
      if (key === 'oxblood') {
        await tx.look.updateMany({
          where: { id, items: JSON.stringify([{ productId: ids.get('silk-blouse'), x: 50, y: 30 }]) },
          data: { items },
        })
        await tx.look.updateMany({
          where: { id, description: 'Oxblood silk tucked into a long, clean line of black.' },
          data: { description },
        })
      }
    }
    for (const [slug, title, content] of editorial) {
      await tx.page.upsert({ where: { slug }, update: {}, create: { slug, title, content, themeId: theme.id } })
    }
    const previous = activate ? await tx.theme.findFirst({ where: { isActive: true, NOT: { id: theme.id } } }) : null
    for (const [handle, items] of Object.entries(menus)) {
      const name = handle === 'main' ? 'Header menu' : 'Footer menu'
      const themeHandle = `${handle}@${theme.id}`
      const itemsJson = JSON.stringify(items)
      const formerLinks: Record<string, string> = { collection: '/collections/all', salon: '/', atelier: '/pages/ombrine-atelier', journal: '/pages/ombrine-journal' }
      const former = items.map((item) => ({ ...item, link: formerLinks[item.id] ?? item.link }))
      const legacy = [{ id: 'salon', label: 'The salon', link: '/' }, ...former.filter((item) => item.id !== 'salon')]
      await tx.menu.updateMany({
        where: { handle: { in: theme.isActive ? [themeHandle, handle] : [themeHandle] }, itemsJson: { in: [JSON.stringify(former), ...(handle === 'main' ? [JSON.stringify(legacy)] : [])] } },
        data: { itemsJson },
      })
      const stored = await tx.menu.upsert({ where: { handle: themeHandle }, update: {}, create: { handle: themeHandle, name, itemsJson } })
      if (previous) {
        const live = await tx.menu.findUnique({ where: { handle } })
        const oldHandle = `${handle}@${previous.id}`
        await tx.menu.upsert({ where: { handle: oldHandle }, update: {}, create: { handle: oldHandle, name, itemsJson: live?.itemsJson ?? JSON.stringify(DEFAULT_MENUS[handle as keyof typeof menus]) } })
      }
      if (activate && !theme.isActive) await tx.menu.upsert({ where: { handle }, create: { handle, name, itemsJson: stored.itemsJson }, update: { itemsJson: stored.itemsJson } })
    }
    if (activate && !theme.isActive) {
      await tx.theme.updateMany({ where: { isActive: true }, data: { isActive: false } })
      await tx.theme.update({ where: { id: theme.id }, data: { isActive: true } })
    }
    return theme.name
  }, { timeout: 45_000 })
  console.log(`${result} installed with ${looks.length} looks and ${products.length} products${activate ? ' and activated' : ''}.`)
} finally {
  await db.$disconnect()
}
