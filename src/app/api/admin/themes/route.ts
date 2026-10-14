import * as themes from '@/backend/routes/admin/themes'
import { withThemes } from '@/backend/lib/store'

export const GET = withThemes(themes.GET)
export const POST = withThemes(themes.POST)
export const PUT = withThemes(themes.PUT)
export const DELETE = withThemes(themes.DELETE)

// Installing uploads every referenced template asset.
export const maxDuration = 300
