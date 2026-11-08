// One-off: show the NexEcoms name and dirham prices on the installed Ombrine theme.
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const theme = await db.theme.findUniqueOrThrow({ where: { slug: 'ombrine' } })
const settings = { ...JSON.parse(theme.settings || '{}'), logo_text: 'NexEcoms', ombrine_currency: 'AED' }
await db.theme.update({ where: { id: theme.id }, data: { settings: JSON.stringify(settings) } })
const brand = await db.brand.updateMany({ where: { slug: 'ombrine', name: 'Ombrine' }, data: { name: 'NexEcoms' } })
console.log('theme updated; brands renamed:', brand.count)
await db.$disconnect()
