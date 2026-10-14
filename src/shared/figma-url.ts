// Parses Figma links pasted by admins. Shared by the admin UI (instant feedback) and the API (validation).
//
// Accepted:
//   https://www.figma.com/design/<fileKey>/<name>?node-id=1-2
//   https://www.figma.com/file/<fileKey>/<name>            (legacy design URL)
//   https://www.figma.com/proto/<fileKey>/<name>?node-id=1-2&starting-point-node-id=1:2
//   https://www.figma.com/design/<fileKey>/branch/<branchKey>/<name>
//   https://www.figma.com/files/team/<teamId>/<name>  and  https://www.figma.com/files/<orgId>/team/<teamId>/<name>
// Rejected: FigJam boards (/board/), Slides (/slides/), other hosts.

export type FigmaLink =
  | { kind: 'file'; fileKey: string; branchKey: string | null; nodeId: string | null; startNodeId: string | null }
  | { kind: 'team'; teamId: string }

export class FigmaLinkError extends Error {}

const KEY = /^[A-Za-z0-9]{10,64}$/
const NODE_ID = /^\d+:\d+$/

/** URL node ids use "-" ("1-2"); the API uses ":" ("1:2"). */
export function normalizeNodeId(value: string | null): string | null {
  if (!value) return null
  const id = decodeURIComponent(value).trim().replace('-', ':')
  return NODE_ID.test(id) ? id : null
}

export function parseFigmaLink(input: string): FigmaLink {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new FigmaLinkError('Paste a full Figma link starting with https://') }
  if (url.protocol !== 'https:' || !/^(www\.)?figma\.com$/i.test(url.hostname)) throw new FigmaLinkError('That is not a figma.com link')

  const parts = url.pathname.split('/').filter(Boolean)
  const [type] = parts
  if (type === 'board') throw new FigmaLinkError('FigJam boards cannot be imported. Use a Figma Design file.')
  if (type === 'slides' || type === 'deck') throw new FigmaLinkError('Figma Slides cannot be imported. Use a Figma Design file.')

  if (type === 'files') {
    const t = parts.indexOf('team')
    const teamId = t >= 0 ? parts[t + 1] : undefined
    if (!teamId || !/^\d{5,30}$/.test(teamId)) throw new FigmaLinkError('Open the team page in Figma and copy its link (it contains /team/<number>)')
    return { kind: 'team', teamId }
  }

  if (type === 'design' || type === 'file' || type === 'proto') {
    const fileKey = parts[1]
    if (!fileKey || !KEY.test(fileKey)) throw new FigmaLinkError('This Figma link has no valid file key')
    let branchKey: string | null = null
    if (parts[2] === 'branch') {
      branchKey = parts[3] ?? ''
      if (!KEY.test(branchKey)) throw new FigmaLinkError('This Figma branch link has no valid branch key')
    }
    return {
      kind: 'file', fileKey, branchKey,
      nodeId: normalizeNodeId(url.searchParams.get('node-id')),
      startNodeId: normalizeNodeId(url.searchParams.get('starting-point-node-id')),
    }
  }
  throw new FigmaLinkError('Paste a link to a Figma Design file, prototype, branch or team')
}
