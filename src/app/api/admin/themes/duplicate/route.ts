import { duplicateTheme } from '@/backend/routes/admin/themes'
import { withThemes } from '@/backend/lib/store'

export const POST = withThemes(duplicateTheme)
