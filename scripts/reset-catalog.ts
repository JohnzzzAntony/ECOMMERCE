// Delete every product, category and brand for a fresh catalog.
//
//   CONFIRM_RESET=yes bun scripts/reset-catalog.ts
//
// Cascades (schema onDelete) remove product images, reviews, cart/wishlist rows and collection links.
// Order lines keep their snapshot (name, SKU, price); only their productId is cleared.
import { db } from '../src/backend/lib/db'

if (process.env.CONFIRM_RESET !== 'yes') throw new Error('Refusing to run: set CONFIRM_RESET=yes')

const [products, categories, brands] = await db.$transaction([
  db.product.deleteMany(),
  db.category.deleteMany(),
  db.brand.deleteMany(),
])
console.log(`Deleted ${products.count} products, ${categories.count} categories, ${brands.count} brands`)
await db.$disconnect()
