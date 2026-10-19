// Create or update an administrator account.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='secret' bun run admin:create
//
// The password is stored as a scrypt hash (same format the login route verifies).
// Re-running for an existing email resets its password and re-grants the admin role.
import { db } from '../src/backend/lib/db'
import { hashPassword } from '../src/backend/lib/password'
import { LEGACY_STORE_ID } from '../src/backend/lib/store'
import { systemDb } from '../src/backend/lib/tenancy'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address')
if (!password || password.length < 8) throw new Error('Set ADMIN_PASSWORD to at least 8 characters')

const hashed = await hashPassword(password)
const user = await db.user.upsert({
  where: { email },
  update: { password: hashed, role: 'admin', isActive: true },
  create: { email, password: hashed, role: 'admin', isActive: true, firstName: 'Admin' },
})
// Store pages, Figma and design settings also need store membership; the admin owns the default store.
await systemDb().storeMember.upsert({
  where: { storeId_userId: { storeId: LEGACY_STORE_ID, userId: user.id } },
  update: { role: 'OWNER' },
  create: { storeId: LEGACY_STORE_ID, userId: user.id, role: 'OWNER' },
})
console.log(`Admin ready: ${user.email} (role=${user.role}, active=${user.isActive}, store owner)`)
await db.$disconnect()
