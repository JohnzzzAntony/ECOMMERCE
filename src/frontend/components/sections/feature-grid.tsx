import { Container, Heading, RichTextView, SectionShell, SmartImage, SmartLink, grid, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'

export default function FeatureGrid({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; intro: RichText; columns: number }>(section)
  const g = grid(s.columns)
  const itemLevel = s.title ? (s.headingLevel === 'h1' ? 'h2' : s.headingLevel === 'h2' ? 'h3' : 'h4') : s.headingLevel
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {(s.title || s.intro.length > 0) && (
          <div className="space-y-3">
            {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
            <RichTextView value={s.intro} className="opacity-80" />
          </div>
        )}
        <ul className={g.className} style={g.style}>
          {section.blocks.map((b) => {
            const f = b.settings as { icon: ImageValue; title: string; body: string; link: LinkValue }
            return (
              <li key={b.id} className="space-y-3">
                {f.icon && <SmartImage image={f.icon} sizes="96px" className="max-h-16 w-auto" />}
                {f.title && <Heading level={itemLevel} className="text-lg"><SmartLink link={f.link}>{f.title}</SmartLink></Heading>}
                {f.body && <p className="whitespace-pre-line text-sm leading-relaxed opacity-80">{f.body}</p>}
              </li>
            )
          })}
        </ul>
      </Container>
    </SectionShell>
  )
}
