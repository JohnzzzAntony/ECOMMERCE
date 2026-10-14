import { Card, Container, Heading, SectionShell, SmartImage, SmartLink, cardLink, grid, settingsOf, type SectionProps } from './shared'
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
                <SmartLink link={item.link} className={cardLink}>
                  <figure className="h-full">
                    <Card media={<SmartImage image={item.image} fill sizes="(min-width: 1024px) 33vw, 50vw" />}>
                      {item.caption && <figcaption className="text-sm opacity-80">{item.caption}</figcaption>}
                    </Card>
                  </figure>
                </SmartLink>
              </li>
            )
          })}
        </ul>
      </Container>
    </SectionShell>
  )
}
