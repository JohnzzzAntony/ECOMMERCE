import { Container, Heading, SectionShell, SmartImage, settingsOf, type SectionProps } from './shared'
import type { ImageValue } from '@/shared/sections/fields'

/** YouTube/Vimeo become privacy-friendly embeds; https .mp4/.webm play natively. Anything else is ignored. */
export function embedFor(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    const yt = u.hostname.replace(/^www\./, '') === 'youtu.be' ? u.pathname.slice(1) : /(^|\.)youtube\.com$/.test(u.hostname) ? (u.searchParams.get('v') ?? u.pathname.match(/\/(embed|shorts)\/([\w-]+)/)?.[2]) : null
    if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt}` }
    const vimeo = /(^|\.)vimeo\.com$/.test(u.hostname) ? u.pathname.match(/\/(\d+)/)?.[1] : null
    if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo}?dnt=1` }
    if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: 'video', src: u.toString() }
  } catch { /* invalid URL */ }
  return null
}

export default function Video({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; url: string; poster: ImageValue; autoplay: boolean }>(section)
  const embed = s.url ? embedFor(s.url) : null
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-6">
        {s.title && <Heading level={s.headingLevel} className="text-3xl">{s.title}</Heading>}
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-3,12px)] bg-black">
          {embed?.kind === 'iframe' && <iframe src={`${embed.src}${s.autoplay ? `${embed.src.includes('?') ? '&' : '?'}autoplay=1&mute=1&muted=1` : ''}`} title={s.title || 'Video'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 h-full w-full border-0" />}
          {embed?.kind === 'video' && <video src={embed.src} poster={s.poster?.url} controls playsInline muted={s.autoplay} autoPlay={s.autoplay} className="absolute inset-0 h-full w-full object-cover" />}
          {!embed && <SmartImage image={s.poster} fill sizes="100vw" />}
        </div>
      </Container>
    </SectionShell>
  )
}
