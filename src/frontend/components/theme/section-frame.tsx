'use client'
// Wraps one homepage section: applies its style settings (colors, fonts, spacing, background,
// visibility) as scoped CSS variables, plays its entrance animation when scrolled into view, and
// marks it with data-section-id so the theme editor can select it with a click.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { SECTION_TYPES, type ThemeSection, type ThemeSettings } from '@/shared/theme'

// One observer for every animated section on the page.
let observer: IntersectionObserver | null = null
function observe(el: Element) {
  observer ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('is-in')
      observer!.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -10% 0px' })
  observer.observe(el)
  return () => observer?.unobserve(el)
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function sectionStyle(s: ThemeSettings): { style: CSSProperties; className: string } {
  const style: Record<string, string> = {}
  const cls = ['theme-section']
  const set = (key: string, flag: string | null, ...vars: string[]) => {
    const v = str(s[key])
    if (!v) return
    for (const name of vars) style[name] = v
    if (flag) cls.push(flag)
  }
  set('bg_color', 'has-bg', 'backgroundColor')
  set('text_color', null, 'color', '--brand-ink', '--foreground')
  set('heading_color', 'has-heading-color', '--sec-heading')
  set('accent_color', null, '--brand-cyan', '--brand-teal', '--primary')
  set('heading_font', null, '--theme-font-heading')
  set('body_font', null, 'fontFamily', '--theme-font-body')
  set('text_align', 'has-align', 'textAlign')
  const image = str(s.bg_image)
  if (image) {
    style.backgroundImage = `url("${image.replace(/["\\\n]/g, encodeURIComponent)}")`
    style['--sec-overlay'] = String(num(s.bg_overlay) / 100)
    cls.push('has-bg', 'has-bg-image')
  }
  if (num(s.heading_size)) { style['--sec-heading-size'] = `${num(s.heading_size)}px`; cls.push('has-heading-size') }
  if (num(s.padding_top)) style.paddingTop = `${num(s.padding_top)}px`
  if (num(s.padding_bottom)) style.paddingBottom = `${num(s.padding_bottom)}px`
  if (s.hide_mobile === true) cls.push('max-sm:hidden')
  if (s.hide_desktop === true) cls.push('sm:hidden')
  const extra = str(s.css_class).replace(/[^\w\s-]/g, '').trim()
  if (extra) cls.push(extra)
  return { style: style as CSSProperties, className: cls.join(' ') }
}

export function SectionFrame({ section, settings, children }: { section: ThemeSection; settings: ThemeSettings; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const animation = str(settings.animation)
  const animated = !!animation && animation !== 'none'
  const animKey = animated ? `${animation}-${settings.animation_duration}-${settings.animation_delay}` : 'static'
  const { style, className } = sectionStyle(settings)

  useEffect(() => {
    if (animKey === 'static' || !ref.current) return
    return observe(ref.current)
  }, [animKey])

  return (
    <div
      // Remount when the animation changes so the editor replays it.
      key={animKey}
      ref={ref}
      data-section-id={section.id}
      data-section-label={SECTION_TYPES[section.type].label}
      data-anim={animated ? animation : undefined}
      className={animated ? `${className} sec-anim` : className}
      style={animated
        ? { ...style, '--sec-dur': `${num(settings.animation_duration) || 700}ms`, '--sec-delay': `${num(settings.animation_delay)}ms` } as CSSProperties
        : style}
    >
      {children}
    </div>
  )
}
