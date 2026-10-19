import { db } from './src/backend/lib/db'
import { storeDb } from './src/backend/lib/tenancy'
const s = storeDb('legacy')
try {
  const files = await s.figmaFile.findMany({ select: { id: true, fileKey: true, name: true }, orderBy: { updatedAt: 'desc' }, take: 10 })
  const jobs = await s.designImport.findMany({ select: { id: true, fileId: true, status: true, error: true, pageAssignments: true, stats: true, warnings: true }, orderBy: { createdAt: 'desc' }, take: 6 })
  console.log(JSON.stringify({ files, jobs }))
} finally { await db.$disconnect() }
