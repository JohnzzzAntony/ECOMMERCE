import { listRevisions, rollbackRevision } from '@/backend/routes/admin/themes'
import { withThemes } from '@/backend/lib/store'

export const GET = withThemes(listRevisions)
export const POST = withThemes(rollbackRevision)
