'use client'

import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, SplitText)

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const titles = '.om-index-heading h1, .om-content > header h1, .om-product-layout h1, .om-look-index-footer h2'
const blocks = '.om-index-heading > div, .om-index-bar, .om-collection-item, .om-look-card, .om-editorial > *, .om-product-layout > div > :not(h1), .om-search-looks, .om-pagination, .om-footer > *'
const photos = '.om-index-photo img, .om-look-card img, .om-product-layout .om-product-image img'
const CURTAIN = 'om-curtain'

// Page motion for the editorial pages: Lenis smooth scrolling, GSAP scroll reveals, and a 0.7s curtain between
// pages (never on the first load). The salon home keeps its own horizontal Lenis rail, so `smooth` is off there.
export function useOmbrineMotion(smooth: boolean) {
  const root = useRef<HTMLDivElement>(null)
  const curtain = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  // The curtain comes down on the previous page; lift it once the new path has rendered.
  useLayoutEffect(() => {
    const el = curtain.current
    const since = Date.now() - Number(sessionStorage.getItem(CURTAIN))
    sessionStorage.removeItem(CURTAIN)
    // Only a curtain dropped moments ago by a click; a stale flag must not cover a fresh page load.
    if (!el || !(since >= 0 && since < 5000)) return
    gsap.timeline()
      .set(el, { yPercent: 0, visibility: 'visible' })
      .to(el, { yPercent: -100, duration: .7, ease: 'power3.inOut', delay: .08 })
      .set(el, { visibility: 'hidden', yPercent: 100 })
  }, [pathname])

  useEffect(() => {
    const el = root.current
    if (!el || !smooth || reduced()) return
    const lenis = new Lenis({ lerp: .09, wheelMultiplier: 1 })
    lenis.scrollTo(0, { immediate: true })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const context = gsap.context(() => {
      el.querySelectorAll<HTMLElement>(titles).forEach((title) => {
        SplitText.create(title, {
          type: 'words,chars', mask: 'words', autoSplit: true,
          onSplit: (split) => gsap.from(split.chars, { yPercent: 110, duration: 1.1, stagger: .022, ease: 'expo.out', scrollTrigger: { trigger: title, start: 'top 92%', once: true } }),
        })
      })
      gsap.set(el.querySelectorAll(blocks), { y: 46, opacity: 0 })
      ScrollTrigger.batch(el.querySelectorAll(blocks), {
        start: 'top 94%', once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1.1, stagger: .08, ease: 'expo.out', clearProps: 'opacity,transform' }),
      })
      el.querySelectorAll(photos).forEach((photo) => gsap.fromTo(photo, { scale: 1.14, yPercent: 4 }, {
        scale: 1, yPercent: -4, ease: 'none', scrollTrigger: { trigger: photo, start: 'top bottom', end: 'bottom top', scrub: true },
      }))
    }, el)
    ScrollTrigger.refresh()

    return () => {
      context.revert()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [smooth, pathname])

  const navigate = (e: MouseEvent<HTMLDivElement>) => {
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if ((link.target && link.target !== '_self') || link.hasAttribute('download') || link.closest('dialog')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin || url.pathname === location.pathname || reduced() || !curtain.current) return
    e.preventDefault()
    sessionStorage.setItem(CURTAIN, String(Date.now()))
    gsap.timeline()
      .set(curtain.current, { yPercent: 100, visibility: 'visible' })
      .to(curtain.current, { yPercent: 0, duration: .7, ease: 'power3.inOut', onComplete: () => router.push(url.pathname + url.search + url.hash) })
  }

  return { root, curtain, navigate }
}
