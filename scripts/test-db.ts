// Throwaway local PostgreSQL for database tests (RLS, E2E): never touches DATABASE_URL from .env.
//   bun scripts/test-db.ts start     → initialises .test-db/, applies migrations, prints TEST_DATABASE_URL, keeps
//                                      running until Ctrl+C (the database stops with this process)
//   bun scripts/test-db.ts stop --clean   → removes the data directory
// Migrations run as the superuser (table owner); tests connect as "app", a role without SUPERUSER/BYPASSRLS, so
// row level security is enforced exactly as in production.
import EmbeddedPostgres from 'embedded-postgres'
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const PORT = Number(process.env.TEST_DB_PORT ?? 54329)
const DIR = '.test-db'
const pg = new EmbeddedPostgres({ databaseDir: DIR, user: 'postgres', password: 'postgres', port: PORT, persistent: true, onLog: () => {} })
const admin = `postgresql://postgres:postgres@127.0.0.1:${PORT}/nexecoms_test`
export const appUrl = `postgresql://app:app@127.0.0.1:${PORT}/nexecoms_test`

async function start() {
  const fresh = !existsSync(DIR)
  if (fresh) await pg.initialise()
  await pg.start()
  if (fresh) {
    await pg.createDatabase('nexecoms_test')
    execSync('bunx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: admin }, stdio: 'inherit' })
    const client = pg.getPgClient('nexecoms_test')
    await client.connect()
    await client.query(`CREATE ROLE app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;`)
    await client.end()
  }
  console.log(`TEST_DATABASE_URL=${appUrl}`)
  console.log(`TEST_DATABASE_ADMIN_URL=${admin}`)
  const shutdown = async () => { await pg.stop().catch(() => {}); process.exit(0) }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
  await new Promise(() => {}) // keep the server alive
}

async function stop() {
  await pg.stop().catch(() => {})
  if (process.argv.includes('--clean')) rmSync(DIR, { recursive: true, force: true })
}

if (import.meta.main) {
  const cmd = process.argv[2]
  if (cmd === 'start') await start()
  else if (cmd === 'stop') await stop()
  else { console.error('usage: bun scripts/test-db.ts start|stop [--clean]'); process.exit(1) }
}
