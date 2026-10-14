import { color, settingsOf, type SectionProps } from './shared'
import type { ColorValue } from '@/shared/sections/fields'

export default function Spacer({ section }: SectionProps) {
  const s = settingsOf<{ height: number; mobileHeight: number; background: ColorValue }>(section)
  const id = section.id.replace(/[^\w-]/g, '')
  return (
    <div data-sid={id} aria-hidden style={{ height: s.height, background: color(s.background) }}>
      <style>{`@media (max-width:767px){[data-sid="${id}"]{height:${Number(s.mobileHeight) || 0}px!important}}`}</style>
    </div>
  )
}
