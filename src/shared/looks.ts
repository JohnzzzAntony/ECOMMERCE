// "Try the Look": the pieces of a look are store products pinned on the model photo (x/y in % of the photo).
import { z } from 'zod'

export const LOOK_MAX_PIECES = 6

const pieceSchema = z.object({
  productId: z.string().min(1).max(64),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})
export const lookPiecesSchema = z.array(pieceSchema).max(LOOK_MAX_PIECES)
export type LookPiece = z.infer<typeof pieceSchema>

/** Pieces from the stored JSON; anything malformed reads as no pieces. */
export function readLookPieces(json: string | null | undefined): LookPiece[] {
  try {
    const parsed = lookPiecesSchema.safeParse(JSON.parse(json || '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

/** A visible look as served by GET /api/looks. */
export type PublicLook = { id: string; name: string; imageUrl: string; pieces: LookPiece[] }
