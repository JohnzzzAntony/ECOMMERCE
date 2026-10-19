'use client'
// Interactive parts of freeform sections (freeform.tsx):
// - FigmaVariants: prototype "Change to" interactions (hover, click, press, drag, after delay) with smart animate.
//   Layers are matched by their layer path (data-fl) and animated from their old to their new box (FLIP).
// - Scroll stories: scroll-down/scroll-up interactions (screens the prototype steps through with the arrow keys)
//   are driven by the wheel, touch swipes and the keyboard once the scene fills the screen, then smart-animate.
// - FigmaScroll: mouse drag (with momentum) for Figma scrolling frames; touch and wheel scroll natively.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { IRInteraction, IRTransition } from '@/shared/design-ir'

type Box = { x: number; y: number; w: number; h: number; opacity: string; bg: string; color: string }
const INSTANT: IRTransition = { type: 'instant', duration: 0, easing: 'linear' }

function boxes(root: HTMLElement | null) {
  const out = new Map<string, Box>()
  if (!root) return out
  for (const el of root.querySelectorAll<HTMLElement>('[data-fl]')) out.set(el.dataset.fl!, measure(el, root))
  return out
}

/** Box relative to the nearest matched ancestor, so nested layers don't move twice. */
function measure(el: HTMLElement, root: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  const parent = el.parentElement?.closest<HTMLElement>('[data-fl]')
  const p = parent && root.contains(parent) ? parent.getBoundingClientRect() : { left: 0, top: 0 }
  const cs = getComputedStyle(el)
  return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, opacity: cs.opacity, bg: cs.backgroundColor, color: cs.color }
}

function animate(root: HTMLElement, before: Map<string, Box>, t: IRTransition) {
  const options = (easing: string): KeyframeAnimationOptions => ({ duration: t.duration, easing })
  const run = (el: HTMLElement, frames: Keyframe[]) => {
    try { el.animate(frames, options(t.easing)) } catch { el.animate(frames, options('ease')) } // e.g. linear() unsupported
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-fl]')) {
    const prev = before.get(el.dataset.fl!)
    const next = measure(el, root)
    if (!prev || t.type === 'dissolve') { if (el.dataset.fl === '' || !prev) run(el, [{ opacity: 0 }, { opacity: next.opacity }]); continue }
    const from: Keyframe = {}, to: Keyframe = {}
    const dx = prev.x - next.x, dy = prev.y - next.y
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { from.transform = `translate(${dx}px, ${dy}px)`; to.transform = 'translate(0, 0)' }
    if (Math.abs(prev.w - next.w) > 0.5) { from.width = `${prev.w}px`; to.width = `${next.w}px` }
    if (Math.abs(prev.h - next.h) > 0.5) { from.height = `${prev.h}px`; to.height = `${next.h}px` }
    if (prev.opacity !== next.opacity) { from.opacity = prev.opacity; to.opacity = next.opacity }
    if (prev.bg !== next.bg) { from.backgroundColor = prev.bg; to.backgroundColor = next.bg }
    if (prev.color !== next.color) { from.color = prev.color; to.color = next.color }
    if (Object.keys(from).length) run(el, [from, to])
  }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function FigmaVariants({ states, interactions }: { states: Record<string, ReactNode>; interactions: Record<string, IRInteraction[]> }) {
  const [current, setCurrent] = useState('@')
  const wrap = useRef<HTMLDivElement>(null)
  const pending = useRef<{ before: Map<string, Box>; t: IRTransition } | null>(null)
  const entered = useRef<IRTransition>(INSTANT)
  const hover = useRef<{ from: string; t: IRTransition } | null>(null)
  const press = useRef<{ from: string; t: IRTransition } | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  const go = useCallback((to: string, t: IRTransition) => {
    if (!states[to]) return
    const transition = reducedMotion() ? INSTANT : t
    pending.current = { before: boxes(wrap.current), t: transition }
    entered.current = transition
    setCurrent(to)
  }, [states])
  const story = Object.values(interactions).some((list) => list.some((i) => i.trigger === 'scroll-down' || i.trigger === 'scroll-up'))
  const currentRef = useRef(current)
  useEffect(() => { currentRef.current = current }, [current])

  // Scroll story: step between scenes when the visitor scrolls at the edge of the current one.
  useEffect(() => {
    if (!story) return
    let lockedUntil = 0, wheelSum = 0, wheelAt = 0, touchY: number | null = null, touchDone = false
    const scene = () => wrap.current?.firstElementChild as HTMLElement | null
    const edge = (dir: 'scroll-down' | 'scroll-up') => {
      const el = scene()
      const i = (interactions[currentRef.current] ?? []).find((x) => x.trigger === dir)
      if (!el || !i) return null
      const r = el.getBoundingClientRect(), vh = window.innerHeight
      // Down: the scene (once its top is aligned with the screen's) shows its bottom: taller scenes scroll natively
      // first. Up: its top is on screen.
      const bottomAligned = r.top > 0 ? r.height : r.bottom
      const at = dir === 'scroll-down' ? r.top < vh * 0.25 && bottomAligned <= vh + 2 && r.bottom > vh * 0.4 : r.top >= -2 && r.top < vh * 0.6
      return at ? { i, top: r.top } : null
    }
    const step = (dir: 'scroll-down' | 'scroll-up') => {
      const hit = edge(dir)
      if (!hit) return false
      if (Math.abs(hit.top) > 1) window.scrollBy({ top: hit.top, behavior: 'instant' as ScrollBehavior })
      lockedUntil = performance.now() + (reducedMotion() ? 0 : hit.i.transition.duration) + 200
      go(hit.i.to, hit.i.transition)
      return true
    }
    const locked = () => performance.now() < lockedUntil
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return // pinch zoom
      const dir = e.deltaY > 0 ? 'scroll-down' : 'scroll-up'
      if (locked()) { if (edge(dir) || edge(dir === 'scroll-down' ? 'scroll-up' : 'scroll-down')) e.preventDefault(); return }
      if (!edge(dir)) { wheelSum = 0; return }
      e.preventDefault()
      const now = performance.now()
      if (now - wheelAt > 250) wheelSum = 0
      wheelAt = now; wheelSum += e.deltaY
      if (Math.abs(wheelSum) >= 30) { wheelSum = 0; step(dir) }
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.altKey || e.ctrlKey || e.metaKey || t?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]')) return
      const dir = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey) ? 'scroll-down' : e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? 'scroll-up' : null
      if (!dir) return
      if (locked()) { if (edge(dir)) e.preventDefault(); return }
      if (step(dir)) e.preventDefault()
    }
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; touchDone = false }
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null) return
      const dy = touchY - (e.touches[0]?.clientY ?? touchY)
      const dir = dy > 0 ? 'scroll-down' : 'scroll-up'
      if (touchDone || locked()) { if (edge(dir)) e.preventDefault(); return }
      if (!edge(dir)) return
      e.preventDefault()
      if (Math.abs(dy) > 40) { touchDone = true; step(dir) }
    }
    // Shown from outside (the editor selecting a layer of another scene).
    const onShow = (e: Event) => { const id = (e as CustomEvent<string>).detail; go(states[id] ? id : '@', INSTANT) }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('figma:scene', onShow)
    // A scene the editor asked for before this story mounted.
    const wanted = (window as { __figmaScene?: string }).__figmaScene
    const initial = wanted && wanted !== currentRef.current ? setTimeout(() => go(states[wanted] ? wanted : '@', INSTANT), 0) : undefined
    return () => {
      clearTimeout(initial)
      window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart); window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('figma:scene', onShow)
    }
  }, [story, interactions, states, go])

  const find = (trigger: IRInteraction['trigger'] | IRInteraction['trigger'][]) => (interactions[current] ?? []).find((i) => (Array.isArray(trigger) ? trigger : [trigger]).includes(i.trigger))

  useLayoutEffect(() => {
    const p = pending.current
    pending.current = null
    if (p && wrap.current && p.t.type !== 'instant' && p.t.duration > 0) animate(wrap.current, p.before, p.t)
  }, [current])

  // "After delay": counted from the end of the transition into this state. Not run with reduced motion.
  useEffect(() => {
    if (reducedMotion()) return
    const timers = (interactions[current] ?? []).filter((i) => i.trigger === 'timeout')
      .map((i) => setTimeout(() => go(i.to, i.transition), entered.current.duration + i.delay))
    return () => timers.forEach(clearTimeout)
  }, [current, interactions, go])

  // Enter/leave from relatedTarget (stateless: stays correct while layers are swapped under the pointer).
  const outside = (e: ReactPointerEvent) => !(e.relatedTarget instanceof Node && wrap.current?.contains(e.relatedTarget))
  return (
    <div
      ref={wrap}
      style={{ display: 'contents' }}
      onPointerOver={(e) => {
        if (e.pointerType !== 'mouse' || !outside(e) || hover.current) return
        const i = find(['hover', 'mouse-enter'])
        if (!i) return
        if (i.trigger === 'hover') hover.current = { from: current, t: i.transition }
        go(i.to, i.transition)
      }}
      onPointerOut={(e) => {
        if (e.pointerType !== 'mouse' || !outside(e)) return
        if (hover.current) { const h = hover.current; hover.current = null; go(h.from, h.t); return }
        const i = find('mouse-leave')
        if (i) go(i.to, i.transition)
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        const i = find('press')
        if (i) { press.current = { from: current, t: i.transition }; go(i.to, i.transition) }
      }}
      onPointerMove={(e) => {
        if (!drag.current || Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 24) return
        drag.current = null
        const i = find('drag')
        if (i) go(i.to, i.transition)
      }}
      onPointerUp={() => {
        drag.current = null
        if (press.current) { const p = press.current; press.current = null; go(p.from, p.t) }
      }}
      onClick={() => { const i = find('click'); if (i) go(i.to, i.transition) }}
    >
      {states[current]}
    </div>
  )
}

/** Mouse drag scrolling with momentum for [data-figma-scroll] frames (touch, wheel and trackpad scroll natively). */
export function FigmaScroll() {
  useEffect(() => {
    const cleanups: (() => void)[] = []
    for (const el of document.querySelectorAll<HTMLElement>('[data-figma-scroll]:not([data-fs])')) {
      el.dataset.fs = '1'
      let start: { x: number; y: number; left: number; top: number } | null = null
      let moved = false, vx = 0, vy = 0, last = 0, frame = 0
      const down = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        cancelAnimationFrame(frame)
        start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }; moved = false; vx = vy = 0; last = performance.now()
      }
      const move = (e: PointerEvent) => {
        if (!start) return
        const dx = e.clientX - start.x, dy = e.clientY - start.y
        if (!moved && Math.hypot(dx, dy) < 5) return
        if (!moved) { moved = true; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing' }
        const now = performance.now(), prevLeft = el.scrollLeft, prevTop = el.scrollTop
        el.scrollLeft = start.left - dx; el.scrollTop = start.top - dy
        const dt = Math.max(1, now - last); last = now
        vx = (el.scrollLeft - prevLeft) / dt; vy = (el.scrollTop - prevTop) / dt
      }
      const up = () => {
        if (!start) return
        start = null; el.style.cursor = ''
        if (!moved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        let t = performance.now()
        const glide = (now: number) => {
          const dt = now - t; t = now
          el.scrollLeft += vx * dt; el.scrollTop += vy * dt
          vx *= Math.pow(0.95, dt / 16); vy *= Math.pow(0.95, dt / 16)
          if (Math.abs(vx) + Math.abs(vy) > 0.02) frame = requestAnimationFrame(glide)
        }
        frame = requestAnimationFrame(glide)
      }
      // A drag must not also click a link or start dragging an image.
      const click = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false } }
      const dragstart = (e: DragEvent) => e.preventDefault()
      el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
      el.addEventListener('click', click, true); el.addEventListener('dragstart', dragstart)
      cleanups.push(() => {
        cancelAnimationFrame(frame); delete el.dataset.fs
        el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
        el.removeEventListener('click', click, true); el.removeEventListener('dragstart', dragstart)
      })
    }
    return () => cleanups.forEach((f) => f())
  }, [])
  return null
}
