// Standalone design-import worker. The web server already processes jobs in-process after each request; run this
// as a separate process when imports should keep running independently of web traffic (or on several machines:
// jobs are claimed with SELECT … FOR UPDATE SKIP LOCKED, so workers never take the same job).
// It also polls Figma for new versions of imported files that have no webhook (every 15 minutes per file).
//   bun scripts/design-worker.ts
import { log } from '../src/backend/lib/log'
import { runNextJob } from '../src/backend/lib/design-import/pipeline'
import { storeDb, systemDb } from '../src/backend/lib/tenancy'
import { figmaAuth } from '../src/backend/lib/figma/connection'
import { pollForUpdates } from '../src/backend/lib/figma/resync'

const IDLE_MS = 5_000
const POLL_EVERY_MS = 5 * 60_000
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; log('info', 'design worker stopping', { signal }) })

async function pollAllStores() {
  const files = await systemDb().figmaFile.findMany({ where: { webhookId: null }, select: { storeId: true }, distinct: ['storeId'] })
  for (const { storeId } of files) {
    const ctx = { db: storeDb(storeId), store: { id: storeId } }
    try { await pollForUpdates(ctx, await figmaAuth(ctx), 20) } catch (error) { log('warn', 'update polling failed', { storeId, error }) }
  }
}

let lastPoll = 0
log('info', 'design worker started', {})
while (!stopping) {
  try {
    const worked = await runNextJob()
    if (Date.now() - lastPoll > POLL_EVERY_MS) { lastPoll = Date.now(); await pollAllStores() }
    if (!worked) await new Promise((r) => setTimeout(r, IDLE_MS))
  } catch (error) {
    log('error', 'design worker loop error', { error })
    await new Promise((r) => setTimeout(r, IDLE_MS))
  }
}
process.exit(0)
