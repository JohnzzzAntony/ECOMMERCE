import { Container, Heading, SectionShell, SmartImage, settingsOf, type SectionProps } from './shared'
import type { ImageValue } from '@/shared/sections/fields'

/** YouTube/Vimeo become privacy-friendly embeds; https .mp4/.webm play natively. Anything else is ignored. */
export function embedFor(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  if (/^\/api\/design\/storage\/[\w./-]+\.(mp4|webm)$/.test(url)) return { kind: 'video', src: url } // local storage driver
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

/**
 * A video filling its box as a background (Figma layer, hero): muted autoplay loop by default, covering the box
 * like an image fill. YouTube/Vimeo play as a muted background embed.
 */
export function BackgroundVideo({ url, poster, autoplay = true, loop = true, controls = false, label }: { url: string; poster?: string; autoplay?: boolean; loop?: boolean; controls?: boolean; label?: string }) {
  const embed = embedFor(url)
  if (!embed) return null
  if (embed.kind === 'iframe') {
    const params = `autoplay=${autoplay ? 1 : 0}&mute=1&muted=1&loop=${loop ? 1 : 0}&controls=${controls ? 1 : 0}&background=${controls ? 0 : 1}&playsinline=1`
    return <iframe src={`${embed.src}${embed.src.includes('?') ? '&' : '?'}${params}`} title={label || 'Video'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="pointer-events-none absolute inset-0 h-full w-full border-0" style={{ pointerEvents: controls ? 'auto' : 'none' }} />
  }
  return (
    <video src={embed.src} poster={poster} autoPlay={autoplay} loop={loop} muted={autoplay || !controls} controls={controls} playsInline preload={autoplay ? 'auto' : 'metadata'}
      aria-label={label} className="absolute inset-0 h-full w-full object-cover" />
  )
}
