import { Button, Container, Heading, RichTextView, SectionShell, SmartImage, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'

export default function CtaBanner({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; body: RichText; image: ImageValue; ctaLabel: string; ctaLink: LinkValue; align: string }>(section)
  return (
    <SectionShell section={section} className="overflow-hidden" style={s.image && !section.settings.textColor ? { color: '#fff' } : undefined}>
      {s.image && <><SmartImage image={{ ...s.image, decorative: true }} fill sizes="100vw" /><div className="absolute inset-0 bg-black/40" aria-hidden /></>}
      <Container section={section} className="relative z-10 flex flex-col gap-4" >
        <div className="space-y-3" style={{ marginInline: s.align === 'center' ? 'auto' : undefined, maxWidth: '48rem' }}>
          {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
          <RichTextView value={s.body} className="text-lg opacity-90" />
        </div>
        <div style={{ textAlign: 'var(--s-align)' as never }}><Button label={s.ctaLabel} link={s.ctaLink} /></div>
      </Container>
    </SectionShell>
  )
}
