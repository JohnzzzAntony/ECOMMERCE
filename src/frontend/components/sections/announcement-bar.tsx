import { SectionShell, SmartLink, settingsOf, type SectionProps } from './shared'
import type { LinkValue } from '@/shared/sections/fields'

export default function AnnouncementBar({ section }: SectionProps) {
  const s = settingsOf<{ text: string; link: LinkValue }>(section)
  if (!s.text) return null
  return (
    <SectionShell section={section} as="aside" label="Announcement" className="text-sm" style={{ background: section.settings.background ? undefined : 'var(--color-primary, #0D6B8C)', color: section.settings.textColor ? undefined : 'var(--color-on-primary, #fff)' }}>
      <div className="mx-auto max-w-[var(--container,1200px)] px-4" style={{ textAlign: 'var(--s-align)' as never }}>
        <SmartLink link={s.link} className="underline-offset-2 hover:underline">{s.text}</SmartLink>
      </div>
    </SectionShell>
  )
}
