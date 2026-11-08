'use client'

import gsap from 'gsap'
import Lenis from 'lenis'
import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

const planes = [['far', .13], ['back', .38], ['front', 1.28]] as const
const motionQuery = '(prefers-reduced-motion: reduce)'

type Drag = { x: number; y: number; start: number; lastX: number; lastTime: number; velocity: number; moved: boolean }

export function useOmbrineRail(active: boolean, drift: boolean) {
  const gallery = useRef<HTMLElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const scroller = useRef<Lenis | null>(null)
  const drag = useRef<Drag | null>(null)
  const ignoreClick = useRef(false)
  const idleAfter = useRef(0)
  const flags = useRef({ active, drift })
  const distance = useRef(0)
  const cycle = useRef(0)

  useLayoutEffect(() => {
    const room = gallery.current
    const el = rail.current
    const track = el?.querySelector<HTMLElement>('.om-track')
    const row = track?.querySelector<HTMLElement>('.om-track-row')
    if (!room || !el || !track || !row) return
    const media = matchMedia(motionQuery)
    const setters = planes.map(([name, speed]) => ({ speed, set: gsap.quickSetter(room, `--om-${name}-shift`, 'px') }))
    let previous = el.scrollLeft
    let idlePixels = 0
    let previousViewport = 0

    const paint = () => {
      const width = cycle.current
      if (!width) return
      // The clipped trailing row makes the native scroll range exactly two complete rows.
      // Unwrap the physical offset before applying the independent plane speeds.
      const position = el.scrollLeft
      if (position === previous) return
      distance.current += gsap.utils.wrap(-width, width, position - previous)
      previous = position
      setters.forEach(({ speed, set }) => set(-gsap.utils.wrap(0, width, distance.current * speed)))
    }

    const lenis = new Lenis({
      wrapper: el,
      content: track,
      eventsTarget: room,
      orientation: 'horizontal',
      gestureOrientation: 'both',
      infinite: true,
      syncTouch: true,
      autoResize: false,
      lerp: .085,
      wheelMultiplier: 1.18,
      virtualScroll: ({ deltaX, deltaY, event }) => {
        if (event.ctrlKey || !flags.current.active || drag.current?.moved || ('touches' in event && event.touches.length > 1)) return false
        idleAfter.current = performance.now() + 2600
        if (!media.matches) return true
        if (event.type === 'wheel') {
          if (event.cancelable) event.preventDefault()
          lenis.scrollTo(lenis.actualScroll + (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY), { immediate: true })
        }
        return false
      },
    })
    scroller.current = lenis

    const resize = () => {
      const width = row.offsetWidth
      const viewport = el.clientWidth
      if (!width || !viewport || (width === cycle.current && viewport === previousViewport)) return
      previousViewport = viewport
      const oldWidth = cycle.current
      const phase = oldWidth ? gsap.utils.wrap(0, oldWidth, el.scrollLeft) / oldWidth : 0
      cycle.current = width
      room.style.setProperty('--om-cycle', `${width}px`)
      room.style.setProperty('--om-rail-viewport', `${viewport}px`)
      el.scrollLeft = width + phase * width
      previous = el.scrollLeft
      lenis.resize()
      setters.forEach(({ speed, set }) => set(-gsap.utils.wrap(0, width, distance.current * speed)))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    observer.observe(row)
    const tick = (time: number, delta: number) => {
      lenis.raf(time * 1000)
      if (flags.current.active && flags.current.drift && !media.matches && !drag.current &&
          !el.contains(document.activeElement) && !lenis.isScrolling && performance.now() >= idleAfter.current) {
        idlePixels += Math.min(delta, 32) * .027
        if (idlePixels >= 1) {
          const pixels = Math.floor(idlePixels)
          idlePixels -= pixels
          lenis.scrollTo(lenis.actualScroll + pixels, { immediate: true })
        }
      }
      paint()
    }
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      observer.disconnect()
      lenis.destroy()
      scroller.current = null
    }
  }, [])

  useLayoutEffect(() => {
    flags.current = { active, drift }
    if (active) scroller.current?.start()
    else {
      drag.current = null
      scroller.current?.stop()
    }
  }, [active, drift])

  const move = (direction: number) => {
    const lenis = scroller.current
    const el = rail.current
    if (!el || !lenis) return
    idleAfter.current = performance.now() + 2600
    lenis.scrollTo(lenis.targetScroll + direction * el.clientWidth * .42, { programmatic: false, lerp: .085 })
  }

  const start = (e: PointerEvent<HTMLDivElement>) => {
    ignoreClick.current = false
    if (e.button !== 0 || e.pointerType === 'touch') return
    drag.current = { x: e.clientX, y: e.clientY, start: e.currentTarget.scrollLeft, lastX: e.clientX, lastTime: performance.now(), velocity: 0, moved: false }
  }

  const pan = (e: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current
    const lenis = scroller.current
    if (!gesture || !lenis) return
    if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 6) return
    if (!gesture.moved) {
      e.currentTarget.setPointerCapture(e.pointerId)
      gesture.start = e.currentTarget.scrollLeft
    }
    const now = performance.now()
    const velocity = (gesture.lastX - e.clientX) / Math.max(1, now - gesture.lastTime)
    gesture.velocity = gesture.velocity * .55 + velocity * .45
    gesture.lastX = e.clientX
    gesture.lastTime = now
    gesture.moved = true
    ignoreClick.current = true
    lenis.scrollTo(gesture.start + gesture.x - e.clientX, { immediate: true, programmatic: false })
  }

  const stop = (coast = false) => {
    const gesture = drag.current
    drag.current = null
    idleAfter.current = performance.now() + 2600
    if (!coast || !gesture?.moved || performance.now() - gesture.lastTime > 95 || matchMedia(motionQuery).matches) return
    const lenis = scroller.current
    const el = rail.current
    if (!lenis || !el) return
    const reach = el.clientWidth * .48
    const momentum = gsap.utils.clamp(-reach, reach, gesture.velocity * 190)
    if (Math.abs(momentum) > 8) lenis.scrollTo(lenis.actualScroll + momentum, { programmatic: false, lerp: .09 })
  }

  const leave = () => { if (!drag.current?.moved) stop() }
  const captureClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!ignoreClick.current || event.detail === 0) return
    ignoreClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { gallery, rail, distance, move, start, pan, stop, leave, captureClick }
}
