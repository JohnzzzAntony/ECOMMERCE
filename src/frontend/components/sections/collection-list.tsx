import { Container, Heading, SectionShell, SmartImage, grid, settingsOf, type SectionProps } from './shared'
import type { ImageValue } from '@/shared/sections/fields'

export default function CollectionList({ section, data }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; columns: number }>(section)
  const collections = data?.collections ?? []
  const overrides = new Map(section.blocks.map((b) => [String((b.settings as { collection: string }).collection), b.settings as { image: ImageValue; label: string }]))
  const g = grid(s.columns, 2)
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        {collections.length === 0 ? <p className="opacity-70">No collections to show yet.</p> : (
          <ul className={g.className} style={g.style}>
            {collections.map((c) => {
              const o = overrides.get(c.slug)
              const image = o?.image ?? (c.image ? { url: c.image, alt: '', decorative: true, width: 800, height: 600 } : null)
              return (
                <li key={c.slug}>
                  <a href={`/collections/${encodeURIComponent(c.slug)}`} className="group block overflow-hidden rounded-[var(--radius-3,12px)] border border-black/5">
                    <div className="relative aspect-[4/3] bg-black/5">{image && <SmartImage image={{ ...image, alt: '' }} fill sizes="(min-width: 1024px) 33vw, 50vw" className="transition-transform group-hover:scale-105" />}</div>
                    <div className="p-4"><span className="font-semibold">{o?.label || c.name}</span><span className="ml-2 text-sm opacity-60">{c.count} products</span></div>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </Container>
    </SectionShell>
  )
}
