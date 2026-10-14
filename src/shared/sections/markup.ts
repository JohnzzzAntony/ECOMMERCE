// Plain-text markup for editing rich text in the admin: **bold**, *italic*, ++underline++, ~~strike~~,
// [label](link), "- " list items, blank line between paragraphs. Parsed into the structured RichText that is stored,
// so no HTML is ever saved. Links: "/" home, /pages/x, /products/x, /collections/x, https://, mailto:, tel:.
import type { LinkValue, RichText } from './fields'

type Run = RichText[number]['runs'][number]

export function hrefToLink(href: string): LinkValue | null {
  const h = href.trim()
  if (h === '/') return { kind: 'page', slug: '' }
  let m = h.match(/^\/pages\/([a-z0-9-]+)$/)
  if (m) return { kind: 'page', slug: m[1] }
  if (h === '/cart') return { kind: 'page', slug: '_cart' }
  m = h.match(/^\/products\/([^/?#\s]+)$/)
  if (m) return { kind: 'product', slug: decodeURIComponent(m[1]) }
  m = h.match(/^\/collections\/([^/?#\s]+)$/)
  if (m) return { kind: 'collection', slug: decodeURIComponent(m[1]) }
  if (/^(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+|tel:[+\d\s()-]+)$/i.test(h)) return { kind: 'url', url: h, newTab: false }
  return null
}

export function linkToHref(link: LinkValue): string {
  switch (link.kind) {
    case 'page': return link.slug === '' ? '/' : link.slug === '_cart' ? '/cart' : `/pages/${link.slug}`
    case 'product': return `/products/${encodeURIComponent(link.slug)}`
    case 'collection': return `/collections/${encodeURIComponent(link.slug)}`
    case 'url': return link.url
    default: return ''
  }
}

const TOKEN = /(\[[^\]\n]+\]\([^)\s]+\)|\*\*[^*\n]+\*\*|\+\+[^+\n]+\+\+|~~[^~\n]+~~|\*[^*\n]+\*)/g

function parseInline(text: string): Run[] {
  const runs: Run[] = []
  for (const part of text.split(TOKEN)) {
    if (!part) continue
    let m: RegExpMatchArray | null
    if ((m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/))) {
      const link = hrefToLink(m[2])
      runs.push(link ? { text: m[1], link } : { text: m[1] })
    } else if ((m = part.match(/^\*\*(.+)\*\*$/))) runs.push({ text: m[1], bold: true })
    else if ((m = part.match(/^\+\+(.+)\+\+$/))) runs.push({ text: m[1], underline: true })
    else if ((m = part.match(/^~~(.+)~~$/))) runs.push({ text: m[1], strike: true })
    else if ((m = part.match(/^\*(.+)\*$/))) runs.push({ text: m[1], italic: true })
    else runs.push({ text: part })
  }
  return runs
}

export function fromMarkup(value: string): RichText {
  const out: RichText = []
  for (const block of value.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) for (const l of lines) out.push({ type: 'li', runs: parseInline(l.replace(/^\s*[-•]\s+/, '')) })
    else out.push({ type: 'p', runs: parseInline(block) })
  }
  return out
}

export function toMarkup(value: RichText | undefined): string {
  return (value ?? []).map((p) => {
    const text = p.runs.map((r) => {
      let t = r.text
      if (r.bold) t = `**${t}**`
      if (r.italic) t = `*${t}*`
      if (r.underline) t = `++${t}++`
      if (r.strike) t = `~~${t}~~`
      if (r.link && r.link.kind !== 'none') t = `[${t}](${linkToHref(r.link)})`
      return t
    }).join('')
    return p.type === 'li' ? `- ${text}` : text
  }).reduce((acc, line, i, all) => {
    if (i === 0) return line
    const prevLi = (value ?? [])[i - 1]?.type === 'li' && (value ?? [])[i]?.type === 'li'
    return `${acc}${prevLi ? '\n' : '\n\n'}${line}`
  }, '')
}
