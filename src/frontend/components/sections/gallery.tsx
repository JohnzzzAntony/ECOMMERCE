import { Container, Heading, SectionShell, SmartImage, SmartLink, grid, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue } from '@/shared/sections/fields'

export default function Gallery({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; columns: number }>(section)
  const g = grid(s.columns, 2)
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        <ul className={g.className} style={g.style}>
          {section.blocks.map((b) => {
            const item = b.settings as { image: ImageValue; caption: string; link: LinkValue }
            if (!item.image) return null
            return (
              <li key={b.id}>
                <figure className="space-y-2">
                  <SmartLink link={item.link}><SmartImage image={item.image} sizes="(min-width: 1024px) 33vw, 50vw" className="w-full rounded-[var(--radius-3,12px)]" /></SmartLink>
                  {item.caption && <figcaption className="text-sm opacity-80">{item.caption}</figcaption>}
                </figure>
              </li>
            )
          })}
        </ul>
      </Container>
    </SectionShell>
  )
}
