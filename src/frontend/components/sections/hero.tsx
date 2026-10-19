import { Button, Container, Heading, RText, RichTextView, SectionShell, SmartImage, responsive, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'
import { BackgroundVideo } from './video'

type HeroSettings = { eyebrow: string; title: string; headingLevel: string; subtitle: RichText; image: ImageValue; video?: string; layout: string; overlay: number; align: string; ctaLabel: string; ctaLink: LinkValue; secondaryLabel: string; secondaryLink: LinkValue }

export default function Hero({ section, priority }: SectionProps) {
  const s = settingsOf<HeroSettings>(section)
  const image = responsive<ImageValue>(section, 'image')
  const title = responsive<string>(section, 'title')
  const background = s.layout === 'background' && (!!s.image || !!s.video)
  const justify = s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start'
  const text = (
    <div className={`relative z-10 flex flex-col gap-4 ${background ? 'max-w-2xl' : ''}`} style={{ alignItems: justify, marginInline: background && s.align === 'center' ? 'auto' : undefined }}>
      {s.eyebrow && <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{s.eyebrow}</p>}
      {s.title && <Heading level={s.headingLevel} className="text-4xl md:text-5xl lg:text-6xl"><RText value={title} /></Heading>}
      <RichTextView value={s.subtitle} className="text-lg opacity-90" />
      {(s.ctaLabel || s.secondaryLabel) && (
        <div className="mt-2 flex flex-wrap gap-3" style={{ justifyContent: justify }}>
          <Button label={s.ctaLabel} link={s.ctaLink} />
          <Button label={s.secondaryLabel} link={s.secondaryLink} variant="secondary" />
        </div>
      )}
    </div>
  )
  if (background) {
    return (
      <SectionShell section={section} className="flex items-center overflow-hidden" style={{ minHeight: 'var(--s-min-h, 520px)', color: section.settings.textColor ? undefined : '#fff' }}>
        <SmartImage image={image.base} mobile={image.mobile} fill priority={priority} sizes="100vw" />
        {s.video && <BackgroundVideo url={s.video} poster={image.base?.url} label={s.title} />}
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(s.overlay ?? 0) / 100})` }} aria-hidden />
        <Container section={section}>{text}</Container>
      </SectionShell>
    )
  }
  const img = <SmartImage image={image.base} mobile={image.mobile} priority={priority} sizes="(min-width: 768px) 50vw, 100vw" className="w-full rounded-[var(--radius-3,12px)]" />
  return (
    <SectionShell section={section} className="flex items-center" style={{ minHeight: 'var(--s-min-h, 520px)' }}>
      <Container section={section} className={`grid items-center gap-10 ${s.image ? 'md:grid-cols-2' : ''}`}>
        {s.layout === 'split-left' && img}
        {text}
        {s.layout !== 'split-left' && img}
      </Container>
    </SectionShell>
  )
}
