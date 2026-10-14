'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button, Container, Heading, SectionShell, SmartImage, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue } from '@/shared/sections/fields'

type Slide = { title: string; subtitle: string; image: ImageValue; ctaLabel: string; ctaLink: LinkValue }

export default function HeroSlideshow({ section, priority }: SectionProps) {
  const s = settingsOf<{ autoplay: boolean; interval: number; headingLevel: string }>(section)
  const slides = section.blocks.map((b) => b.settings as Slide)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(s.autoplay)
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!playing || reduced || slides.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), Math.max(3, s.interval) * 1000)
    return () => clearInterval(t)
  }, [playing, slides.length, s.interval])
  if (!slides.length) return null
  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length)
  return (
    <SectionShell section={section} className="overflow-hidden" label="Slideshow" style={{ color: section.settings.textColor ? undefined : '#fff' }}>
      <div aria-roledescription="carousel" className="relative" style={{ minHeight: 'var(--s-min-h, 520px)' }}>
        {slides.map((slide, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`} hidden={i !== index} className="absolute inset-0 flex items-center">
            <SmartImage image={slide.image} fill priority={priority && i === 0} sizes="100vw" />
            <div className="absolute inset-0 bg-black/30" aria-hidden />
            <Container section={section} className="relative z-10 space-y-4">
              {slide.title && <Heading level={i === 0 ? s.headingLevel : 'h2'} className="max-w-2xl text-4xl md:text-5xl">{slide.title}</Heading>}
              {slide.subtitle && <p className="max-w-xl text-lg opacity-90">{slide.subtitle}</p>}
              <Button label={slide.ctaLabel} link={slide.ctaLink} />
            </Container>
          </div>
        ))}
        {slides.length > 1 && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button type="button" onClick={() => go(-1)} className="inline-flex size-11 items-center justify-center rounded-full bg-black/50" aria-label="Previous slide"><ChevronLeft className="size-5" aria-hidden /></button>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex size-11 items-center justify-center rounded-full bg-black/50" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>{playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}</button>
            <button type="button" onClick={() => go(1)} className="inline-flex size-11 items-center justify-center rounded-full bg-black/50" aria-label="Next slide"><ChevronRight className="size-5" aria-hidden /></button>
          </div>
        )}
      </div>
    </SectionShell>
  )
}
