// Resets the throwaway test database (never the .env database) and creates the E2E admin.
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/backend/lib/password'

export const E2E_ADMIN = { email: 'e2e-admin@example.com', password: 'E2e-admin-password-123' }

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_ADMIN_URL
  if (!url || url === process.env.DATABASE_URL) throw new Error('Start the test database first: bun scripts/test-db.ts start (TEST_DATABASE_ADMIN_URL)')
  const db = new PrismaClient({ datasourceUrl: url })
  try {
    // The superuser bypasses row level security, so it can reset every store's rows.
    await db.$executeRawUnsafe(`TRUNCATE "StorePageVersion","StorePage","Asset","Font","DesignSystem","SectionMapping","DesignImport","FigmaFile","FigmaOAuthState","FigmaConnection","AuditLog","StoreMember" CASCADE`)
    await db.store.update({ where: { id: 'legacy' }, data: { designSource: 'FIGMA', themesEnabled: false } })
    const user = await db.user.upsert({
      where: { email: E2E_ADMIN.email },
      update: { password: await hashPassword(E2E_ADMIN.password), role: 'admin', isActive: true },
      create: { email: E2E_ADMIN.email, password: await hashPassword(E2E_ADMIN.password), role: 'admin', firstName: 'E2E' },
    })
    await db.storeMember.create({ data: { storeId: 'legacy', userId: user.id, role: 'OWNER' } })
  } finally { await db.$disconnect() }
}
