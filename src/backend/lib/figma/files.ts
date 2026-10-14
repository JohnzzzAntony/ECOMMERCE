// Read-only Figma browsing for the frame picker: file structure, thumbnails, prototype flows, team files.
// Endpoint details verified 2026-10-14 against https://developers.figma.com/docs/rest-api/file-endpoints/ ,
// /folders-endpoints/ and /file-property-types/ (FlowStartingPoint, NodeAction).
import { HttpError } from '@/backend/lib/auth'
import { FigmaApiError, figmaRequest, type FigmaAuth } from './client'

type Node = {
  id: string; name: string; type: string; children?: Node[]
  absoluteBoundingBox?: { width: number; height: number } | null
  flowStartingPoints?: { nodeId: string; name: string }[]
  interactions?: { actions?: ({ type: string; destinationId?: string | null; navigation?: string } | null)[] }[]
  transitionNodeID?: string | null
}
type FileResponse = { name: string; lastModified: string; version: string; editorType?: string; thumbnailUrl?: string; document: Node }

export type FrameInfo = { id: string; name: string; width: number; height: number; section: string | null }
export type FileStructure = {
  fileKey: string; branchKey: string | null; name: string; version: string; lastModified: string; thumbnailUrl: string | null
  pages: { id: string; name: string; flows: { nodeId: string; name: string }[]; frames: FrameInfo[] }[]
}

/** The key used in API paths: a branch key replaces the file key (per the file endpoints docs). */
export const apiKey = (fileKey: string, branchKey: string | null) => branchKey ?? fileKey

const frameInfo = (n: Node, section: string | null): FrameInfo => ({
  id: n.id, name: n.name, section,
  width: Math.round(n.absoluteBoundingBox?.width ?? 0), height: Math.round(n.absoluteBoundingBox?.height ?? 0),
})

/** Pages and their top-level frames (frames directly on the page or inside a top-level section). */
export function structureFromFile(file: FileResponse, fileKey: string, branchKey: string | null): FileStructure {
  if (file.editorType && file.editorType !== 'figma') throw new HttpError(400, 'Only Figma Design files can be imported (this is a FigJam or Slides file).')
  return {
    fileKey, branchKey, name: file.name, version: file.version, lastModified: file.lastModified, thumbnailUrl: file.thumbnailUrl ?? null,
    pages: (file.document.children ?? []).filter((p) => p.type === 'CANVAS').map((page) => ({
      id: page.id,
      name: page.name,
      flows: (page.flowStartingPoints ?? []).map(({ nodeId, name }) => ({ nodeId, name })),
      frames: (page.children ?? []).flatMap((n) =>
        n.type === 'FRAME' ? [frameInfo(n, null)]
          : n.type === 'SECTION' ? (n.children ?? []).filter((c) => c.type === 'FRAME').map((c) => frameInfo(c, n.name))
            : []),
    })),
  }
}

function mapFigmaError(error: unknown): never {
  if (error instanceof FigmaApiError) {
    if (error.status === 404) throw new HttpError(404, 'Figma file not found. Check the link and that the connected account can open it.')
    if (error.status === 403) throw new HttpError(403, 'The connected Figma account cannot open this file, or the token is missing a required scope.')
    if (error.status === 429) throw new HttpError(429, 'Figma is rate limiting requests. Wait a minute and try again.')
  }
  if (error instanceof HttpError) throw error
  throw new HttpError(502, 'Figma did not respond. Please try again.')
}

/** depth=3 returns pages, their top-level nodes and one level below (frames inside sections). */
export async function fileStructure(auth: FigmaAuth, fileKey: string, branchKey: string | null) {
  const file = await figmaRequest<FileResponse>(`/v1/files/${apiKey(fileKey, branchKey)}?depth=3`, auth).catch(mapFigmaError)
  return structureFromFile(file, fileKey, branchKey)
}

/** Low-resolution PNG renders for the picker grid. URLs expire (30 days); never stored or shown to shoppers. */
export async function frameThumbnails(auth: FigmaAuth, fileKey: string, branchKey: string | null, ids: string[]) {
  const params = new URLSearchParams({ ids: ids.join(','), scale: '0.25', format: 'png' })
  const res = await figmaRequest<{ err: string | null; images: Record<string, string | null> }>(`/v1/images/${apiKey(fileKey, branchKey)}?${params}`, auth).catch(mapFigmaError)
  return res.images ?? {}
}

/** Prototype links leaving a node subtree: NODE actions (navigate, overlay, swap) and the legacy transitionNodeID. */
export function prototypeTargets(node: Node, out = new Set<string>()) {
  if (node.transitionNodeID) out.add(node.transitionNodeID)
  for (const interaction of node.interactions ?? []) {
    for (const action of interaction.actions ?? []) {
      if (action?.type === 'NODE' && action.destinationId && ['NAVIGATE', 'OVERLAY', 'SWAP'].includes(action.navigation ?? 'NAVIGATE')) out.add(action.destinationId)
    }
  }
  for (const child of node.children ?? []) prototypeTargets(child, out)
  return out
}

const NODES_BATCH = 10
const MAX_FLOW_FRAMES = 100

/** Every top-level frame reachable from `startId` by following prototype links (breadth first). */
export async function flowFrames(auth: FigmaAuth, fileKey: string, branchKey: string | null, frameIds: Set<string>, startId: string) {
  if (!frameIds.has(startId)) throw new HttpError(400, 'The flow must start at a top-level frame of this file')
  const seen = new Set([startId])
  let frontier = [startId]
  while (frontier.length && seen.size < MAX_FLOW_FRAMES) {
    const next: string[] = []
    for (let i = 0; i < frontier.length; i += NODES_BATCH) {
      const ids = frontier.slice(i, i + NODES_BATCH)
      const res = await figmaRequest<{ nodes: Record<string, { document: Node } | null> }>(
        `/v1/files/${apiKey(fileKey, branchKey)}/nodes?ids=${encodeURIComponent(ids.join(','))}`, auth).catch(mapFigmaError)
      for (const entry of Object.values(res.nodes ?? {})) {
        if (!entry) continue
        for (const target of prototypeTargets(entry.document)) {
          if (frameIds.has(target) && !seen.has(target) && seen.size < MAX_FLOW_FRAMES) { seen.add(target); next.push(target) }
        }
      }
    }
    frontier = next
  }
  return [...seen]
}

// Team browsing. The v2 folder endpoints replace the deprecated v1 project endpoints but their response bodies
// are not documented (checked 2026-10-14), and folders:read is unavailable to public OAuth apps. Try v2, fall back
// to v1 (projects:read), and accept either shape.
type Listing = Record<string, unknown>
const asArray = (body: Listing, ...keys: string[]) => {
  for (const k of keys) if (Array.isArray(body?.[k])) return body[k] as Listing[]
  return []
}

async function firstWorking<T>(paths: string[], auth: FigmaAuth): Promise<T> {
  let last: unknown
  for (const path of paths) {
    try { return await figmaRequest<T>(path, auth) } catch (error) {
      last = error
      if (!(error instanceof FigmaApiError) || ![400, 403, 404].includes(error.status)) break
    }
  }
  mapFigmaError(last)
}

export async function teamProjects(auth: FigmaAuth, teamId: string) {
  const body = await firstWorking<Listing>([`/v2/teams/${teamId}/folders`, `/v1/teams/${teamId}/projects`], auth)
  return asArray(body, 'folders', 'projects')
    .map((p) => ({ id: String(p.id ?? ''), name: String(p.name ?? 'Untitled') }))
    .filter((p) => /^\d+$/.test(p.id))
}

export async function projectFiles(auth: FigmaAuth, projectId: string) {
  const body = await firstWorking<Listing>([`/v2/folders/${projectId}/files`, `/v1/projects/${projectId}/files`], auth)
  return asArray(body, 'files')
    .map((f) => ({ key: String(f.key ?? ''), name: String(f.name ?? 'Untitled'), thumbnailUrl: (f.thumbnail_url as string) ?? null, lastModified: (f.last_modified as string) ?? null }))
    .filter((f) => /^[A-Za-z0-9]{10,64}$/.test(f.key))
}
