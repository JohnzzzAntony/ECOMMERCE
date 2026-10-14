import { exportTheme } from '@/backend/routes/admin/themes'
import { withThemes } from '@/backend/lib/store'

export const GET = withThemes(exportTheme)
