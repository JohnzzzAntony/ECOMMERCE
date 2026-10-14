import { Container, Heading, SectionShell, SmartImage, SmartLink, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue } from '@/shared/sections/fields'

export default function LogoCloud({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; grayscale: boolean }>(section)
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-xl md:text-2xl">{s.title}</Heading>}
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-6" style={{ justifyContent: section.settings.align === 'left' ? 'flex-start' : section.settings.align === 'right' ? 'flex-end' : 'center' }}>
          {section.blocks.map((b) => {
            const l = b.settings as { image: ImageValue; link: LinkValue }
            if (!l.image) return null
            return <li key={b.id}><SmartLink link={l.link}><SmartImage image={l.image} sizes="160px" className={`max-h-12 w-auto ${s.grayscale ? 'opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0' : ''}`} /></SmartLink></li>
          })}
        </ul>
      </Container>
    </SectionShell>
  )
}
