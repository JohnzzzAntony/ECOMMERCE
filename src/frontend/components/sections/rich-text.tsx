import { Button, Container, Heading, RText, RichTextView, SectionShell, responsive, settingsOf, type SectionProps } from './shared'
import type { LinkValue, RichText } from '@/shared/sections/fields'

const WIDTH: Record<string, string> = { narrow: 'max-w-2xl', normal: 'max-w-3xl', wide: 'max-w-5xl' }

export default function RichTextSection({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; body: RichText; width: string; align: string; ctaLabel: string; ctaLink: LinkValue }>(section)
  return (
    <SectionShell section={section}>
      <Container section={section}>
        <div className={`${WIDTH[s.width] ?? WIDTH.normal} space-y-5`} style={{ marginInline: s.align === 'center' ? 'auto' : s.align === 'right' ? '0 0 0 auto' : undefined }}>
          {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl"><RText value={responsive<string>(section, 'title')} /></Heading>}
          <RichTextView value={s.body} className="text-base leading-relaxed" />
          <Button label={s.ctaLabel} link={s.ctaLink} />
        </div>
      </Container>
    </SectionShell>
  )
}
