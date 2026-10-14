import { Button, Container, Heading, RText, RichTextView, SectionShell, SmartImage, responsive, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'

export default function ImageWithText({ section, priority }: SectionProps) {
  const s = settingsOf<{ image: ImageValue; imagePosition: string; eyebrow: string; title: string; headingLevel: string; body: RichText; ctaLabel: string; ctaLink: LinkValue }>(section)
  const image = responsive<ImageValue>(section, 'image')
  return (
    <SectionShell section={section}>
      <Container section={section} className={`grid items-center gap-10 ${s.image ? 'md:grid-cols-2' : ''}`}>
        {s.image && <div className={s.imagePosition === 'right' ? 'md:order-2' : ''}><SmartImage image={image.base} mobile={image.mobile} priority={priority} sizes="(min-width: 768px) 50vw, 100vw" className="w-full rounded-[var(--radius-3,12px)]" /></div>}
        <div className="space-y-4">
          {s.eyebrow && <p className="text-sm font-semibold uppercase tracking-widest opacity-70">{s.eyebrow}</p>}
          {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl"><RText value={responsive<string>(section, 'title')} /></Heading>}
          <RichTextView value={s.body} className="text-base leading-relaxed opacity-90" />
          <Button label={s.ctaLabel} link={s.ctaLink} />
        </div>
      </Container>
    </SectionShell>
  )
}
