// Building blocks for section components. Server-compatible (no hooks); interactive pieces live in client files.
import type { CSSProperties, ReactNode } from 'react'
import { sizedImage } from '@/frontend/lib/image'
import type { ColorValue, ImageValue, LinkValue, RichText } from '@/shared/sections/fields'
import type { SectionInstance } from '@/shared/sections/registry'
import type { RenderedPage, SectionData } from '@/shared/storefront'
import { tokenSlug } from '@/shared/design-tokens'
import { linkHref } from '@/shared/store-pages'

export type SectionProps = {
  section: SectionInstance
  data: SectionData[string] | undefined
  page: Pick<RenderedPage, 'route' | 'currency' | 'store'>
  /** True for the first visible section: its image is the likely LCP element. */
  priority: boolean
  /** Rendered in the admin editor preview: sections mark their editable parts for click-to-select. */
  editing?: boolean
}

type S = Record<string, unknown>
export const settingsOf = <T extends S = S>(section: SectionInstance) => section.settings as T

/** Value for a key, with tablet/mobile overrides when present. */
export function responsive<T>(section: SectionInstance, key: string): { base: T; tablet?: T; mobile?: T } {
  const r = section.responsive ?? {}
  return { base: section.settings[key] as T, tablet: r.tablet?.[key] as T | undefined, mobile: r.mobile?.[key] as T | undefined }
}

export function color(value: ColorValue | undefined, fallback?: string): string | undefined {
  if (value?.token) return `var(--color-${tokenSlug(value.token)}${fallback ? `, ${fallback}` : ''})`
  return value?.value ?? fallback
}

const NUMERIC_RESPONSIVE: [key: string, css: string, unit: string][] = [['paddingTop', '--s-pt', 'px'], ['paddingBottom', '--s-pb', 'px'], ['minHeight', '--s-min-h', 'px'], ['columns', '--s-cols', ''], ['height', '--s-h', 'px']]
// Grids use --s-cols on desktop, --s-cols-t on tablet, --s-cols-m on mobile (base CSS in storefront-page.tsx).
const deviceVar = (css: string, device: 'tablet' | 'mobile') => (css === '--s-cols' ? `--s-cols-${device === 'tablet' ? 't' : 'm'}` : css)

/** Wrapper every section renders in: colours, spacing, alignment, and tablet/mobile overrides as CSS variables. */
export function SectionShell({ section, children, className = '', as: Tag = 'section', style, label }: { section: SectionInstance; children: ReactNode; className?: string; as?: 'section' | 'header' | 'footer' | 'div' | 'aside'; style?: CSSProperties; label?: string }) {
  const s = settingsOf(section)
  const vars: Record<string, string> = {}
  for (const [key, css, unit] of NUMERIC_RESPONSIVE) if (typeof s[key] === 'number') vars[css] = `${s[key]}${unit}`
  const bg = color(s.background as ColorValue)
  const fg = color(s.textColor as ColorValue)
  const overrides = (['tablet', 'mobile'] as const).map((device) => {
    const r = section.responsive?.[device]
    if (!r) return ''
    const decl = NUMERIC_RESPONSIVE.filter(([k]) => typeof r[k] === 'number').map(([k, css, unit]) => `${deviceVar(css, device)}:${r[k] as number}${unit}`)
    if (typeof r.align === 'string' && /^(left|center|right)$/.test(r.align)) decl.push(`--s-align:${r.align}`)
    return decl.length ? `@media (max-width:${device === 'tablet' ? 1199 : 767}px){[data-sid="${section.id.replace(/[^\w-]/g, '')}"]{${decl.join(';')}}}` : ''
  }).join('')
  const align = typeof s.align === 'string' ? s.align : 'left'
  return (
    <Tag
      data-sid={section.id}
      data-section-type={section.type}
      aria-label={label}
      className={`relative ${className}`}
      style={{ ...vars, '--s-align': align, background: bg, color: fg, paddingTop: 'var(--s-pt, 0px)', paddingBottom: 'var(--s-pb, 0px)', ...style } as CSSProperties}
    >
      {overrides && <style>{overrides}</style>}
      {children}
    </Tag>
  )
}

export function Container({ section, children, className = '' }: { section: SectionInstance; children: ReactNode; className?: string }) {
  const full = settingsOf(section).fullWidth === true
  return <div className={`mx-auto w-full px-4 sm:px-6 ${full ? '' : 'max-w-[var(--container,1200px)]'} ${className}`} style={{ textAlign: 'var(--s-align)' as CSSProperties['textAlign'] }}>{children}</div>
}

/** Text with tablet/mobile variants (only one is displayed; display:none hides the others from assistive tech). */
export function RText({ value }: { value: { base: string; tablet?: string; mobile?: string } }) {
  if (!value.tablet && !value.mobile) return <>{value.base}</>
  return (
    <>
      <span className={value.tablet ? 'max-xl:hidden' : value.mobile ? 'max-md:hidden' : ''}>{value.base}</span>
      {value.tablet && <span className={`hidden max-xl:inline ${value.mobile ? 'max-md:hidden' : ''}`}>{value.tablet}</span>}
      {value.mobile && <span className="hidden max-md:inline">{value.mobile}</span>}
    </>
  )
}

export function Heading({ level, children, className = '', style }: { level: unknown; children: ReactNode; className?: string; style?: CSSProperties }) {
  const Tag = (['h1', 'h2', 'h3', 'h4'].includes(String(level)) ? level : 'p') as 'h1' | 'h2' | 'h3' | 'h4' | 'p'
  const token = Tag === 'h1' ? 'heading-1' : Tag === 'h2' ? 'heading-2' : 'heading-3'
  return (
    <Tag className={`font-bold leading-tight ${className}`} style={{ fontFamily: `var(--font-${token}-family, inherit)`, letterSpacing: `var(--font-${token}-letter-spacing, normal)`, ...style }}>
      {children}
    </Tag>
  )
}

export function SmartLink({ link, children, className, ariaLabel, style }: { link: LinkValue | undefined; children: ReactNode; className?: string; ariaLabel?: string; style?: CSSProperties }) {
  const href = linkHref(link)
  if (!href) return <span className={className} style={style}>{children}</span>
  const external = link?.kind === 'url' && link.newTab
  return <a href={href} className={className} style={style} aria-label={ariaLabel} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
}

export function RichTextView({ value, className = '' }: { value: RichText | undefined; className?: string }) {
  if (!value?.length) return null
  return (
    <div className={`space-y-3 ${className}`}>
      {value.map((p, i) => {
        const runs = p.runs.map((r, j) => {
          let node: ReactNode = r.text
          if (r.bold) node = <strong>{node}</strong>
          if (r.italic) node = <em>{node}</em>
          if (r.underline) node = <u>{node}</u>
          if (r.strike) node = <s>{node}</s>
          if (r.link && r.link.kind !== 'none') node = <SmartLink link={r.link} className="underline underline-offset-2">{node}</SmartLink>
          return <span key={j}>{node}</span>
        })
        return p.type === 'li' ? <li key={i} className="ml-5 list-disc">{runs}</li> : <p key={i} className="whitespace-pre-line">{runs}</p>
      })}
    </div>
  )
}

const WIDTHS = [320, 640, 960, 1280, 1920]

/** Responsive image with explicit size (no layout shift); the first section's image loads eagerly with high priority. */
export function SmartImage({ image, sizes = '100vw', className = '', priority = false, mobile, fill = false }: { image: ImageValue | undefined; sizes?: string; className?: string; priority?: boolean; mobile?: ImageValue; fill?: boolean }) {
  if (!image?.url) return null
  const isSvg = /\.svg(\?|$)/i.test(image.url)
  const srcSet = (img: NonNullable<ImageValue>) => (isSvg ? undefined : WIDTHS.filter((w) => w <= img.width * 1.5).concat(img.width < 320 ? [img.width] : []).map((w) => `${sizedImage(img.url, w)} ${w}w`).join(', ') || undefined)
  const alt = image.decorative ? '' : image.alt
  const img = (
    <img
      src={isSvg ? image.url : sizedImage(image.url, Math.min(1280, image.width))}
      srcSet={srcSet(image)}
      sizes={isSvg ? undefined : sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      className={`${fill ? 'absolute inset-0 h-full w-full object-cover' : 'h-auto max-w-full'} ${className}`}
      style={image.blurhash && !fill ? { backgroundColor: 'rgba(0,0,0,0.04)' } : undefined}
    />
  )
  if (!mobile?.url) return img
  return (
    <picture className={fill ? 'absolute inset-0' : undefined}>
      <source media="(max-width: 767px)" srcSet={srcSet(mobile) ?? mobile.url} sizes={sizes} width={mobile.width} height={mobile.height} />
      {img}
    </picture>
  )
}

export function Button({ label, link, variant = 'primary', className = '' }: { label: unknown; link: LinkValue | undefined; variant?: 'primary' | 'secondary'; className?: string }) {
  const text = typeof label === 'string' ? label.trim() : ''
  if (!text) return null
  const styles = variant === 'primary'
    ? { background: 'var(--color-primary, #0D6B8C)', color: 'var(--color-on-primary, #fff)' }
    : { border: '1px solid currentColor' }
  return (
    <SmartLink link={link} style={styles} className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-2,8px)] px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}>
      {text}
    </SmartLink>
  )
}

/** Bordered card with an inset 4:3 media panel and a caption (no panel when `media` is empty); on hover the border brightens, the card lifts and the media zooms. Wrap it in a link to make it clickable. */
export function Card({ media, children }: { media: ReactNode; children?: ReactNode }) {
  return (
    <div className="group/card h-full rounded-[calc(var(--radius-3,12px)+6px)] border border-current/10 bg-current/[0.03] p-1.5 transition-[border-color,translate,box-shadow] duration-500 ease-out hover:-translate-y-0.5 hover:border-current/25 hover:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {media && <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[var(--radius-3,12px)] bg-current/[0.06] *:transition-transform *:duration-700 *:ease-out group-hover/card:*:scale-[1.06] motion-reduce:*:transition-none motion-reduce:group-hover/card:*:scale-100">
        {media}
      </div>}
      {children && <div className="space-y-1 px-3.5 pb-3 pt-3.5">{children}</div>}
    </div>
  )
}

/** Classes for a link wrapping a Card. */
export const cardLink = 'block h-full rounded-[calc(var(--radius-3,12px)+6px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

/** Props for a responsive grid (class s-grid; columns from settings and tablet/mobile overrides). */
export const grid = (n: unknown, mobileDefault = 1) => ({
  className: 's-grid grid gap-6',
  style: { '--s-cols': Math.min(6, Math.max(1, Number(n) || 3)), '--s-cols-m-default': mobileDefault } as CSSProperties,
})
