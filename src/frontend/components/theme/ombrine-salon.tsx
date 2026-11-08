'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { useOmbrineRail } from './use-ombrine-rail'
import { useHydrated } from '@/frontend/hooks/use-hydrated'
import { api } from '@/frontend/lib/api'
import { useStore } from '@/frontend/store/use-store'
import { effectivePrice } from '@/shared/storefront'
import { productSizes, salonCollections, salonCurrency, salonPrice, type SalonLook } from '@/shared/ombrine'
import type { StorefrontTheme } from '@/shared/theme'
import type { Product } from '@/shared/types'
import { OmbrineShell } from './ombrine-shell'
import { Notify, SizeGuide, SizeOptions } from './ombrine-purchase'
import { OmbrineAtmosphere } from './ombrine-atmosphere'

function animatePortrait(image: HTMLImageElement | null, from: DOMRect | undefined) {
  if (!image || !from?.height || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const to = image.getBoundingClientRect()
  if (!to.height) return
  const x = from.left + from.width / 2 - to.left - to.width / 2
  const y = from.top + from.height / 2 - to.top - to.height / 2
  const timeline = gsap.timeline()
  timeline.fromTo(image, { x, y, scale: from.height / to.height }, {
    x: 0, y: 0, scale: 1, duration: .7, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform',
  })
  const details = image.closest('.om-look')?.querySelectorAll('.om-look-copy, .om-pieces')
  if (details?.length) timeline.fromTo(details, { y: 16, opacity: 0 }, {
    y: 0, opacity: 1, duration: .52, stagger: .08, ease: 'power2.out', clearProps: 'opacity,transform',
  }, .13)
  return timeline
}

export function OmbrineHome({ theme, initialLooks, lookId, previewBrand }: { theme: StorefrontTheme; initialLooks?: SalonLook[]; lookId?: string; previewBrand?: string }) {
  const [fetched, setFetched] = useState<SalonLook[]>()
  const [loadError, setLoadError] = useState(false)
  const looks = initialLooks ?? fetched
  const [selected, setSelected] = useState(lookId ?? '')
  const current = looks?.findIndex(({ id }) => id === selected) ?? -1
  const trigger = useRef<HTMLButtonElement | null>(null)
  const portrait = useRef<HTMLImageElement | null>(null)
  const [entrance, setEntrance] = useState<DOMRect>()
  const close = useCallback(() => {
    const from = portrait.current?.getBoundingClientRect()
    setSelected('')
    setEntrance(undefined)
    requestAnimationFrame(() => {
      animatePortrait(trigger.current?.querySelector('img') ?? null, from)
      trigger.current?.focus({ preventScroll: true })
    })
  }, [])
  useLayoutEffect(() => {
    if (current < 0) return
    const motion = animatePortrait(portrait.current, entrance)
    return () => { motion?.revert() }
  }, [current, entrance])
  useEffect(() => {
    if (initialLooks) return
    let live = true
    api.salonLooks(previewBrand).then((data) => { if (live) setFetched(data) }).catch(() => { if (live) setLoadError(true) })
    return () => { live = false }
  }, [initialLooks, previewBrand])
  useEffect(() => {
    if (current < 0 || lookId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, lookId, close])
  return <OmbrineShell theme={theme} footer={!!lookId}>
    <div className="om-stage" data-portrait-entry={!!entrance}>
      {looks?.length ? <div className="om-room" data-receded={current >= 0} inert={current >= 0} aria-hidden={current >= 0 || undefined}>
        <Gallery theme={theme} looks={looks} active={current < 0} onSelect={(id, button) => {
          trigger.current = button
          setEntrance(button.querySelector('img')?.getBoundingClientRect())
          setSelected(id)
        }} />
      </div> : <div className="om-empty" role="status">{loadError ? 'The salon is unavailable. Please refresh to try again.' : looks ? 'The salon is being prepared.' : 'Opening the salon…'}</div>}
      {current >= 0 && looks && <LookDetail key={selected} {...lookScope(looks, current)} theme={theme} standalone={!!lookId} portraitRef={portrait} onClose={close}
        onSelect={(id) => { setEntrance(undefined); setSelected(id) }} />}
    </div>
  </OmbrineShell>
}

const repeats = [0, 1, 2]
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Browsing from a look steps through its own collection.
function lookScope(looks: SalonLook[], index: number) {
  const scope = salonCollections(looks).find((group) => group.looks.includes(looks[index]))?.looks ?? looks
  return { looks: scope, index: scope.indexOf(looks[index]) }
}
const fill = (looks: SalonLook[]) => Array.from({ length: Math.max(8, looks.length) }, (_, i) => looks[i % looks.length])

function Gallery({ looks, theme, active, onSelect }: { looks: SalonLook[]; theme: StorefrontTheme; active: boolean; onSelect: (id: string, button: HTMLButtonElement) => void }) {
  const ready = useHydrated()
  const [paused, setPaused] = useState(false)
  const { gallery, rail, distance, move, start, pan, stop, leave, captureClick } = useOmbrineRail(active, !paused && theme.settings.ombrine_drift === true)
  // Each collection is a row of the room: the main rail is the current one, the next collections wait behind it
  // and the previous one passes in the foreground. Clicking a figure in the back brings its collection forward.
  const collections = salonCollections(looks)
  const count = collections.length
  const [shown, setShown] = useState(0)
  const at = (offset: number) => collections[(((shown + offset) % count) + count) % count]
  const current = at(0)
  const row = fill(current.looks)
  const direction = useRef(0)
  const enter = (offset: number) => {
    const room = gallery.current
    if (!offset || count < 2 || !room || direction.current) return
    direction.current = Math.sign(offset)
    const go = () => setShown((value) => (((value + offset) % count) + count) % count)
    if (reduced()) { direction.current = 0; go(); return }
    const forward = offset > 0
    gsap.timeline({ defaults: { duration: .55, ease: 'power2.in' }, onComplete: go })
      .to(room.querySelector('.om-rail'), { scale: forward ? 1.35 : .5, yPercent: forward ? 22 : -40, opacity: 0, filter: 'blur(10px)' }, 0)
      .to(room.querySelector(forward ? '.om-depth-back' : '.om-depth-front'), { scale: forward ? 1.5 : .6, yPercent: forward ? 60 : -60, opacity: forward ? .9 : 0, filter: 'blur(0px)' }, 0)
      .to(room.querySelectorAll(forward ? '.om-depth-front, .om-depth-far' : '.om-depth-back, .om-depth-far'), { opacity: 0 }, 0)
  }
  // The new collection settles into its row from the depth it came from.
  useLayoutEffect(() => {
    const room = gallery.current
    const from = direction.current
    if (!room || !from) return
    direction.current = 0
    gsap.set(room.querySelectorAll('.om-rail, .om-depth'), { clearProps: 'all' })
    const settle = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(room.querySelector('.om-rail'), { scale: from > 0 ? .55 : 1.3, yPercent: from > 0 ? -45 : 25, opacity: 0, filter: 'blur(4px)' }, { scale: 1, yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1, clearProps: 'all' })
      .from(room.querySelectorAll('.om-depth'), { opacity: 0, duration: 1.1, stagger: .12, clearProps: 'opacity' }, .15)
    return () => { settle.progress(1) }
  }, [shown, gallery])
  const cursor = useRef<HTMLDivElement>(null)
  const [cursorLabel, setCursorLabel] = useState('')

  // First arrival: the room fades up and the figures step onto the floor from the centre outwards.
  useLayoutEffect(() => {
    const room = gallery.current
    if (!room || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro.from(room.querySelectorAll('.om-depth'), { opacity: 0, duration: 1.6, stagger: .15 })
      .from(room.querySelectorAll('.om-model'), { y: 70, opacity: 0, duration: 1.3, stagger: { each: .045, from: 'center' }, clearProps: 'opacity,transform' }, .1)
      .from(room.querySelectorAll('.om-gallery-caption > *'), { y: 12, opacity: 0, duration: .8, stagger: .1, clearProps: 'opacity,transform' }, .7)
    const logo = document.querySelector('.om-logo')
    if (logo) intro.from(logo, { opacity: 0, filter: 'blur(14px)', yPercent: 18, duration: 1.4, clearProps: 'opacity,filter,transform' }, 0)
    return () => { intro.revert() }
  }, [gallery])

  // Contextual cursor for fine pointers: "View" over a look, "Drag" over the floor.
  useEffect(() => {
    const room = gallery.current
    const dot = cursor.current
    if (!room || !dot || !matchMedia('(pointer: fine)').matches) return
    const x = gsap.quickTo(dot, 'x', { duration: .45, ease: 'power3' })
    const y = gsap.quickTo(dot, 'y', { duration: .45, ease: 'power3' })
    const onMove = (e: PointerEvent) => {
      x(e.clientX); y(e.clientY)
      const target = e.target instanceof Element ? e.target : null
      setCursorLabel(target?.closest('.om-model') ? 'View' : target?.closest('.om-rail') ? 'Drag' : target?.closest('.om-depth img') ? target.closest<HTMLElement>('.om-depth')?.dataset.label ?? '' : '')
    }
    const onLeave = () => setCursorLabel('')
    room.addEventListener('pointermove', onMove)
    room.addEventListener('pointerleave', onLeave)
    return () => { room.removeEventListener('pointermove', onMove); room.removeEventListener('pointerleave', onLeave) }
  }, [gallery])

  const depth = (plane: 'far' | 'back' | 'front', phase: number, offset: number) => {
    const plan = fill(at(offset).looks)
    // Figures behind are pointer shortcuts to their collection; the caption buttons are the accessible route.
    return <div className={`om-depth om-depth-${plane}`} aria-hidden="true" data-label={offset > 0 && count > 1 ? at(offset).name : undefined}
      onClick={offset > 0 && count > 1 ? () => enter(offset) : undefined}>
      <div className="om-depth-track">{repeats.map((repeat) => <div className="om-depth-row" key={repeat}>
        {plan.map((_, i) => <div className="om-depth-slot" key={i}>{(plane !== 'front' || i % 4 === 1) &&
          <img src={plan[(i + phase) % plan.length].imageUrl} alt="" draggable={false} />}</div>)}
      </div>)}</div>
    </div>
  }

  return <section className="om-gallery" ref={gallery} aria-label="Explore the looks" data-cursor={!!cursorLabel && active}>
    <h1 className="sr-only">The salon{count > 1 ? `: ${current.name}` : ''}</h1>
    <OmbrineAtmosphere distance={distance} active={active} />
    <div className="om-cursor" ref={cursor} aria-hidden="true"><span>{cursorLabel}</span></div>
    {depth('far', 4, count > 2 ? 2 : 1)}
    {depth('back', 2, 1)}
    <div className="om-rail" ref={rail} onPointerDown={start} onPointerMove={pan} onPointerUp={() => stop(true)} onPointerCancel={() => stop()} onLostPointerCapture={() => stop()}
      onPointerLeave={leave} onClickCapture={captureClick}>
      <div className="om-track">
        {repeats.map((repeat) => <div className="om-track-row" key={repeat}>
          {row.map((look, i) => <button type="button" className="om-model" key={i} disabled={!ready} tabIndex={repeat !== 1 || i >= current.looks.length ? -1 : 0} onClick={(e) => onSelect(look.id, e.currentTarget)}>
            <img src={look.imageUrl} alt="" draggable={false} fetchPriority={repeat === 1 && i < 8 ? 'high' : 'auto'} />
            <span>{look.name}</span>
          </button>)}
        </div>)}
      </div>
    </div>
    {looks.length > 1 && depth('front', 0, count > 1 ? -1 : 0)}
    <div className="om-gallery-caption">
      <div className="om-gallery-controls"><button type="button" aria-label="Browse previous looks" onClick={() => move(-1)}>←</button><button type="button" aria-label="Browse next looks" onClick={() => move(1)}>→</button>
        {theme.settings.ombrine_drift === true && <button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
        {count > 1 && <nav className="om-collection-nav" aria-label="Collections">
          <button type="button" aria-label={`Previous collection, ${at(-1).name}`} onClick={() => enter(-1)}>‹</button>
          <em aria-live="polite">{current.name} <small>{String(shown + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</small></em>
          <button type="button" aria-label={`Next collection, ${at(1).name}`} onClick={() => enter(1)}>›</button>
        </nav>}</div>
      <p>{String(theme.settings.ombrine_drag ?? '')}</p>
      <p>{String(theme.settings.ombrine_scroll ?? '')}</p>
    </div>
  </section>
}

function LookDetail({ looks, index, theme, standalone, portraitRef, onClose, onSelect }: { looks: SalonLook[]; index: number; theme: StorefrontTheme; standalone: boolean; portraitRef: React.Ref<HTMLImageElement>; onClose: () => void; onSelect: (id: string) => void }) {
  const look = looks[index]
  const previousIndex = (index + looks.length - 1) % looks.length
  const nextIndex = (index + 1) % looks.length
  const previous = looks[previousIndex]
  const next = looks[nextIndex]
  const ordinal = (i: number) => String(i + 1).padStart(2, '0')
  const heading = useRef<HTMLHeadingElement>(null)
  const [active, setActive] = useState(0)
  const [sizes, setSizes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [guide, setGuide] = useState(false)
  const [fitting, setFitting] = useState(false)
  const buy = useRef<HTMLDivElement>(null)
  const add = useStore((s) => s.addToCart)
  const openBag = useStore((s) => s.setCartDrawerOpen)
  const product = look.products[active]
  const price = (value: number) => salonPrice(value, salonCurrency(theme))
  const canAddAll = look.products.every((p) => p.inStock)
  useEffect(() => { if (!standalone) heading.current?.focus() }, [standalone])

  const showSize = (piece: Product) => {
    setActive(look.products.indexOf(piece))
    setMessage(`Choose a size for ${piece.name}.`)
    requestAnimationFrame(() => {
      buy.current?.scrollIntoView({ block: 'nearest' })
      buy.current?.querySelector<HTMLButtonElement>('.om-sizes button')?.focus({ preventScroll: true })
    })
  }
  const putInBag = (products: Product[]) => {
    const missing = products.find((piece) => productSizes(piece).length && !sizes[piece.id])
    if (missing) { setFitting(products.length > 1); showSize(missing); return }
    products.forEach((piece) => add(piece, 1, { channel: 'ombrine', size: sizes[piece.id] }))
    setFitting(false)
    setMessage(products.length === 1 ? 'Added to your bag.' : 'The full look is in your bag.')
    openBag(true)
  }
  const choose = (piece: Product, size: string) => {
    const selections = { ...sizes, [piece.id]: size }
    setSizes(selections)
    if (fitting) {
      const missing = look.products.find((item) => productSizes(item).length && !selections[item.id])
      if (missing) { showSize(missing); return }
      setFitting(false)
      setMessage('All sizes selected. Add the full look when ready.')
      return
    }
    setMessage('')
  }
  return <section className="om-look" aria-labelledby="om-look-title">
    <div className="om-look-copy">
      <h1 id="om-look-title" tabIndex={-1} ref={heading}>{look.name}</h1>
      {look.description && <p>{look.description}</p>}
      {standalone ? <Link className="om-link" href="/">Back to the salon <span aria-hidden>→</span></Link> :
        <Link className="om-link" href={`/looks/${look.id}`}>View the look page <span aria-hidden>→</span></Link>}
      {looks.length > 1 && <nav className="om-look-nav" aria-label="Browse looks">
        {standalone ? <Link href={`/looks/${previous.id}`} aria-label={`Previous look, ${previous.name}`}>← <em>{previous.name}</em> <small>{ordinal(previousIndex)}</small></Link> : <button type="button" onClick={() => onSelect(previous.id)} aria-label={`Previous look, ${previous.name}`}>← <em>{previous.name}</em> <small>{ordinal(previousIndex)}</small></button>}
        <span>{ordinal(index)} / {String(looks.length).padStart(2, '0')}</span>
        {standalone ? <Link href={`/looks/${next.id}`} aria-label={`Next look, ${next.name}`}><small>{ordinal(nextIndex)}</small> <em>{next.name}</em> →</Link> : <button type="button" onClick={() => onSelect(next.id)} aria-label={`Next look, ${next.name}`}><small>{ordinal(nextIndex)}</small> <em>{next.name}</em> →</button>}
      </nav>}
    </div>
    <figure className="om-look-model"><img ref={portraitRef} src={look.imageUrl} alt={look.modelName ? `${look.modelName} wearing ${look.name}` : look.name} /></figure>
    {product && <section className="om-pieces" aria-label="Shop the look" tabIndex={0} data-lenis-prevent>
      <div className="om-panel-heading"><h2>{look.products.length === 1 ? 'One piece' : look.products.length === 3 ? 'Three pieces' : `${look.products.length} pieces`}</h2>
        {standalone ? <Link href="/">Close ×</Link> : <button type="button" onClick={onClose}>Close ×</button>}</div>
      <Link className="om-piece-hero om-product-image" href={`/products/${product.slug}`}>{product.images[0] && <img src={product.images[0].imageUrl} alt={product.name} />}</Link>
      <div className="om-piece-list">
        {look.products.map((piece, i) => <button className="om-piece-row" type="button" key={piece.id} aria-pressed={i === active} onClick={() => { setActive(i); setMessage('') }}>
          <span className="om-product-image">{piece.images[0] && <img src={piece.images[0].imageUrl} alt="" />}</span>
          <span className="om-piece-name">{piece.name}</span><span>{price(effectivePrice(piece))}</span>
        </button>)}
      </div>
      <div className="om-buy" ref={buy} key={product.id}>
        <div className="om-size-layout"><SizeOptions product={product} value={sizes[product.id]} onChange={(size) => choose(product, size)} />
          {!!productSizes(product).length && <button type="button" className="om-link" onClick={() => setGuide(true)}>Size guide</button>}</div>
        {message && <p role="status" className="om-fit-message">{message}</p>}
        {product.inStock ? <button className="om-primary" type="button" onClick={() => putInBag([product])}>Add to bag <span>{price(effectivePrice(product))}</span></button> : <Notify product={product} size={sizes[product.id]} />}
      </div>
      {look.products.length > 1 && <button className="om-secondary" disabled={!canAddAll} type="button" onClick={() => putInBag(look.products)}>
        Add the full look <span>{price(look.products.reduce((sum, piece) => sum + effectivePrice(piece), 0))}</span>
      </button>}
      <p className="om-muted">{String(theme.settings.ombrine_delivery ?? '')}</p>
    </section>}
    {guide && <SizeGuide theme={theme} onClose={() => setGuide(false)} />}
  </section>
}

