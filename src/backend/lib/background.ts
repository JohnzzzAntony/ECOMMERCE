// Run work after the response is sent (Next.js `after`); outside a request scope (scripts, tests) run it directly.
import { after } from 'next/server'
import { log } from '@/backend/lib/log'

export function background(task: () => Promise<unknown>) {
  const run = () => task().catch((error) => log('error', 'background task failed', { error }))
  try { after(run) } catch { void run() }
}
