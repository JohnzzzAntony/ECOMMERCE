'use client'
// "Try the Look" homepage section: model photos on a turning 3D ring (desktop) or a walking line (phones), with the
// look's products beside it. Looks are managed in the admin (Try the Look); products, prices and cart are the store's.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { Check, Pause, Play, Plus, X } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { effectivePrice, formatAED } from '@/frontend/lib/format'
import { sizedImage } from '@/frontend/lib/image'
import type { PublicLook } from '@/shared/looks'
import type { Product } from '@/shared/types'
import css from './try-the-look.module.css'

type Look = Omit<PublicLook, 'pieces'> & { items: { product: Product; x: number; y: number }[] }
type Settings = Record<string, string>

export function TryTheLook({ s }: { s: Settings }) {
  const [looks, setLooks] = useState<Look[] | null>(null)
  useEffect(() => {
    let off = false
    api.looks()
      .then(async (list) => {
        const ids = [...new Set(list.flatMap((l) => l.pieces.map((p) => p.productId)))]
        const byId = new Map((ids.length ? await api.productsByIds(ids) : []).map((p) => [p.id, p]))
        if (!off) setLooks(list.map(({ pieces, ...l }) => ({ ...l, items: pieces.flatMap((p) => { const product = byId.get(p.productId); return product ? [{ product, x: p.x, y: p.y }] : [] }) })))
      })
      .catch(() => { if (!off) setLooks([]) })
    return () => { off = true }
  }, [])
  if (!looks?.length) return null
  return <Runway looks={looks} s={s} />
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const wrap = (v: number, n: number) => ((v % n) + n) % n
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function Runway({ looks, s }: { looks: Look[]; s: Settings }) {
  const n = looks.length
  const bodies = Array.from({ length: n * Math.ceil(8 / n) }, (_, a) => a)
  const speed = Math.max(0, Number(s.autoplay ?? 5)) * 1000
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const lbStageRef = useRef<HTMLDivElement>(null)
  const lbModelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const engine = useRef<Engine | null>(null)
  const flags = useRef<Flags>({ zoomed: false, hover: false, engaged: false })
  const lbAt = useRef('')
  const lbTimer = useRef(0)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [lbIndex, setLbIndex] = useState<number | null>(null)
  const [hot, setHot] = useState<number | null>(null)
  const [feet, setFeet] = useState<Record<number, number>>({})
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const cart = useStore((st) => st.cart)
  const addToCart = useStore((st) => st.addToCart)
  const navigate = useStore((st) => st.navigate)

  useEffect(() => {
    const e = createEngine(rootRef.current!, stageRef.current!, { n, speed, flags, onIndex: setIndex, onPlaying: setPlaying, onOpen: () => openLook() })
    engine.current = e
    return () => { e.destroy(); engine.current = null }
  }, [n, speed])

  // Feet detection: shift each photo so the soles sit on the floor line (photos often have empty space below).
  useEffect(() => {
    looks.forEach((look, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = 48, h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth))
          const c = document.createElement('canvas')
          c.width = w; c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(img, 0, 0, w, h)
          const px = ctx.getImageData(0, 0, w, h).data
          for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
            if (px[(y * w + x) * 4 + 3] > 40) { setFeet((f) => ({ ...f, [i]: clamp((h - 1 - y) / h, 0, 0.4) })); return }
          }
        } catch { /* image host without CORS: keep offset 0 */ }
      }
      img.src = sizedImage(look.imageUrl, 96)
    })
  }, [looks])

  // A new look closes the popup and clears highlights.
  useEffect(() => { closeLook(); setHot(null) }, [index])

  function openLook() {
    if (flags.current.zoomed) return
    engine.current?.engage()
    clearTimeout(lbTimer.current)
    flags.current.zoomed = true
    setHot(null)
    setLbIndex(engine.current?.index() ?? 0)
    setZoomed(true)
  }
  function closeLook() {
    if (!flags.current.zoomed) return
    flags.current.zoomed = false
    if (lbModelRef.current && lbAt.current) lbModelRef.current.style.transform = lbAt.current
    setZoomed(false)
    setHot(null)
    if (rootRef.current?.querySelector('[data-lb]')?.contains(document.activeElement)) stageRef.current?.focus({ preventScroll: true })
    lbTimer.current = window.setTimeout(() => setLbIndex(null), 950)
    engine.current?.restartBar()
  }

  // Popup: size the model to the space, then grow it from its runway spot (FLIP).
  useLayoutEffect(() => {
    const model = lbModelRef.current, stage = lbStageRef.current
    if (!zoomed || lbIndex === null || !model || !stage) return
    const sr = stage.getBoundingClientRect()
    model.style.setProperty('--model-h', `${Math.max(160, Math.min(sr.height, sr.width / 0.5625))}px`)
    lbAt.current = ''
    const from = stageRef.current?.querySelector(`[data-hero="${lbIndex}"] [data-figure]`)?.getBoundingClientRect()
    const to = model.querySelector('[data-figure]')?.getBoundingClientRect()
    if (from && to?.height && !reduced()) {
      lbAt.current = `translate3d(${from.left - to.left}px,${from.bottom - to.bottom}px,0) scale(${from.height / to.height})`
      model.style.transition = 'none'
      model.style.transform = lbAt.current
      void model.offsetWidth
      model.style.transition = ''
      model.style.transform = ''
    }
    closeRef.current?.focus({ preventScroll: true })
  }, [zoomed, lbIndex])

  const look = looks[index]
  const inCart = (id: string) => cart.some((c) => c.productId === id)
  const buyable = look.items.filter((i) => i.product.inStock)
  const complete = buyable.length > 0 && buyable.every((i) => inCart(i.product.id))
  const total = buyable.reduce((sum, i) => sum + effectivePrice(i.product), 0)

  const add = (p: Product) => {
    engine.current?.engage()
    addToCart(p, 1)
    setJustAdded(p.id)
    toast.success(`${p.name} added to cart`)
  }
  const addAll = () => {
    engine.current?.engage()
    const todo = buyable.filter((i) => !inCart(i.product.id))
    if (!todo.length) return
    todo.forEach((i) => addToCart(i.product, 1))
    toast.success(todo.length === 1 ? `${todo[0].product.name} added to cart` : `${look.name}: ${todo.length} pieces added to cart`)
  }
  const reveal = (n: number) => {
    const list = listRef.current, card = list?.querySelector<HTMLElement>(`[data-card="${n}"]`)
    if (!list || !card) return
    const behavior = reduced() ? 'auto' : 'smooth'
    if (list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: list.scrollLeft + card.getBoundingClientRect().left - list.getBoundingClientRect().left - 20, behavior })
    else if (list.scrollHeight > list.clientHeight + 1) list.scrollTo({ top: card.offsetTop - list.offsetTop - 12, behavior })
  }
  const open = (p: Product) => navigate('product-detail', { slug: p.slug })

  const figure = (i: number, pins: boolean) => (
    <div className={css.figure} data-figure>
      <div className={css.art} style={{ '--foot': feet[i] ?? 0 } as CSSProperties}>
        <img src={sizedImage(looks[i].imageUrl, 900)} alt={looks[i].name} draggable={false} loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
        {pins && (
          <div className={css.pins}>
            {looks[i].items.map((it, j) => (
              <button key={it.product.id} type="button" className={css.pin} data-tip={it.product.name} data-hot={hot === j + 1}
                style={{ left: `${it.x}%`, top: `${it.y}%`, '--pi': j + 1 } as CSSProperties} aria-label={`${j + 1}: ${it.product.name}`}
                onClick={() => { engine.current?.engage(); setHot(j + 1); reveal(j + 1) }}>
                <span className={css.dot}>{j + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className={css.root} data-playing={playing} data-zoom={zoomed}
      style={{ '--speed': `${speed / 1000}s`, '--progress': (index + 1) / n } as CSSProperties}
      onKeyDown={(e) => { if (e.key === 'Escape') closeLook() }}>
      <div className={css.grid}>
        <div className={css.left}>
          <div className={css.head}>
            {s.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">{s.eyebrow}</p>}
            {s.title && <h2 className="text-3xl text-brand-ink sm:text-4xl">{s.title}</h2>}
            {s.text && <p className="max-w-[46ch] text-sm text-muted-foreground">{s.text}</p>}
            <span className="sr-only" aria-live="polite">{`Look ${index + 1}: ${look.name}`}</span>
          </div>

          <div ref={stageRef} className={css.stage} tabIndex={0} role="region" aria-roledescription="carousel"
            aria-label={`${s.title || 'Try the Look'}: use arrow keys or swipe to change look`}>
            <div className={css.actors}>
              {bodies.map((a) => (
                <div key={a} className={css.body} data-body={a} aria-hidden="true">
                  <span className={css.shadow} />
                  <div className={css.figure}>
                    <div className={css.art} style={{ '--foot': feet[a % n] ?? 0 } as CSSProperties}>
                      <img src={sizedImage(looks[a % n].imageUrl, 900)} alt="" draggable={false} loading={a < n ? 'eager' : 'lazy'} decoding="async" />
                      <button type="button" className={css.hit} data-hit tabIndex={-1} aria-label={`Look ${(a % n) + 1}: ${looks[a % n].name}`}
                        onClick={() => engine.current?.clickBody(a)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={css.heroes}>
              {looks.map((l, i) => (
                <div key={l.id} className={css.hero} data-hero={i} data-on={i === index} aria-hidden={i !== index}>
                  <span className={css.shadow} />
                  {figure(i, false)}
                  <button type="button" className={css.zoom} data-zoom tabIndex={i === index ? 0 : -1} aria-label={`View look: ${l.name}`} onClick={openLook} />
                </div>
              ))}
            </div>
            <span className={css.sweep} />
            <span className={css.cursor} data-cursor>
              <span className={css.cursorIn}><span className={`${css.cursorLabel} ${css.cursorDrag}`}>Drag</span><span className={`${css.cursorLabel} ${css.cursorView}`}>View</span></span>
            </span>
            <span className={css.walk}><span className={css.walkLine} /></span>
          </div>

          {n > 1 && (
            <div className={css.controls}>
              <button type="button" className={`${css.icon} ${css.prev}`} aria-label="Previous look" onClick={() => engine.current?.prev()}>
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M25 7H1M7 1L1 7l6 6" /></svg>
              </button>
              <div className={css.ticks}>
                {looks.map((l, i) => (
                  <button key={l.id} type="button" className={css.tick} data-tick aria-current={i === index} data-past={i < index} aria-label={`Look ${i + 1}: ${l.name}`} onClick={() => engine.current?.go(i)}>
                    <span className={css.bar} />
                    <span className={css.tickLabel}>{String(i + 1).padStart(2, '0')}<span className={css.tickName}>&nbsp;&nbsp;{l.name}</span></span>
                  </button>
                ))}
              </div>
              {speed > 0 && (
                <button type="button" className={css.icon} aria-pressed={playing} aria-label="Autoplay" onClick={() => engine.current?.toggle()}>
                  {playing ? <Pause className="size-3.5" fill="currentColor" strokeWidth={0} /> : <Play className="size-3.5" fill="currentColor" strokeWidth={0} />}
                </button>
              )}
              <button type="button" className={`${css.icon} ${css.next}`} aria-label="Next look" onClick={() => engine.current?.next()}>
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6" /></svg>
              </button>
            </div>
          )}

          <div className={css.lb} data-lb role="region" aria-label="View look" aria-hidden={!zoomed}>
            <div ref={lbStageRef} className={css.lbStage} onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-lb-model]')) closeLook() }}>
              {lbIndex !== null && (
                <div ref={lbModelRef} className={css.lbModel} data-lb-model>
                  <span className={css.shadow} />
                  {figure(lbIndex, true)}
                </div>
              )}
            </div>
            <div className={css.lbTop}>
              <p className="m-0 min-w-0">
                <span className={css.kicker}>Look {String((lbIndex ?? index) + 1).padStart(2, '0')}</span>
                <span className="block truncate text-lg text-brand-ink">{looks[lbIndex ?? index].name}</span>
              </p>
              <button ref={closeRef} type="button" className={css.close} aria-label="Close" onClick={closeLook}><X className="size-4" /></button>
            </div>
            <p className={css.hint}>Tap a dot to shop the piece</p>
          </div>
        </div>

        <aside className={css.panel} onPointerEnter={(e) => { if (e.pointerType === 'mouse') flags.current.hover = true }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') { flags.current.hover = false; engine.current?.restartBar() } }}>
          <div className={css.panelHead}>
            <h3 className="truncate text-lg font-semibold text-brand-ink"><span className="hidden min-[750px]:inline">In this look</span><span className="min-[750px]:hidden">{look.name}</span></h3>
            <span className={css.count}>{look.items.length} {look.items.length === 1 ? 'piece' : 'pieces'}</span>
          </div>
          <ul ref={listRef} className={css.items} key={look.id}>
            {look.items.map(({ product: p }, j) => {
              const n1 = j + 1, added = inCart(p.id), price = effectivePrice(p)
              return (
                <li key={p.id} className={css.item} data-card={n1} data-hot={hot === n1} style={{ '--i': n1 } as CSSProperties}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHot(n1) }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHot(null) }}>
                  <button type="button" className={css.media} tabIndex={-1} aria-hidden="true" onClick={() => open(p)}>
                    {p.images?.[0] && <img src={sizedImage(p.images[0].imageUrl, 240)} alt="" loading="lazy" decoding="async" />}
                    <span className={css.num}>{n1}</span>
                  </button>
                  <div className={css.info}>
                    <span className={css.type}>{p.brand?.name ?? p.category?.name ?? ''}</span>
                    <button type="button" className={css.name} onClick={() => open(p)}>{p.name}</button>
                    <span className={css.price}>
                      {price < p.regularPrice && <s>{formatAED(p.regularPrice)}</s>}
                      <span className="font-semibold text-brand-teal-dark">{formatAED(price)}</span>
                    </span>
                  </div>
                  {p.inStock ? (
                    <button type="button" className={css.add} disabled={added} data-added={added && justAdded === p.id}
                      aria-label={added ? `${p.name} is in your cart` : `Add to cart: ${p.name}`} onClick={() => add(p)}>
                      {added ? <Check className="size-5" /> : <Plus className="size-5" strokeWidth={1.3} />}
                    </button>
                  ) : <span className={css.soldout}>Sold out</span>}
                </li>
              )
            })}
          </ul>
          {buyable.length > 0 && (
            <div className={css.bundle}>
              <div className={css.bundleRow}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-brand-ink">Complete the look</span>
                  <span className="text-xs text-muted-foreground">{buyable.length} {buyable.length === 1 ? 'piece' : 'pieces'}</span>
                </span>
                <strong className="text-lg text-brand-ink">{formatAED(total)}</strong>
              </div>
              <button type="button" className={css.cta} onClick={addAll} disabled={complete}>
                {complete ? 'Full look in your cart' : <>
                  <span className={css.ctaLong}>Add full look to cart</span>
                  <span className={css.ctaShort}>Add full look — {formatAED(total)}</span>
                  <svg width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6" /></svg>
                </>}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- motion engine
type Flags = { zoomed: boolean; hover: boolean; engaged: boolean }
type Engine = ReturnType<typeof createEngine>
type Body = { el: HTMLElement; a: number; w: number; x: number; v: number; g: number; goal: number; trip: boolean; from: number; blur: number }

function createEngine(root: HTMLElement, stage: HTMLElement, o: {
  n: number; speed: number; flags: { current: Flags }
  onIndex: (i: number) => void; onPlaying: (on: boolean) => void; onOpen: () => void
}) {
  const reduce = reduced()
  const K = 95, C = 2 * Math.sqrt(K), LAG = 0.04, START = reduce ? 0 : 1.15
  const ac = new AbortController()
  const on = <E extends Event>(t: EventTarget, type: string, fn: (e: E) => void, opt: AddEventListenerOptions = {}) =>
    t.addEventListener(type, fn as EventListener, { ...opt, signal: ac.signal })
  const bodies: Body[] = [...stage.querySelectorAll<HTMLElement>('[data-body]')].map((el, a) => ({ el, a, w: 0, x: 0, v: 0, g: 0, goal: 0, trip: false, from: 0, blur: -1 }))
  const N = bodies.length, n = o.n
  const cursor = stage.querySelector<HTMLElement>('[data-cursor]')
  let index = 0, target = 0, cur = -START, vel = 0, still: boolean | null = null, visible = false, dragging = false
  let raf = 0, craf = 0, last = 0, timer = 0, suppress = 0, playing = false
  let W = 0, H = 0, fs = 1, unit = 120, mobile = false, ring = true
  let ptr: { id: number; x: number; y: number; t: number; s: { x: number; time: number }[]; drag: boolean } | null = null
  let cx = 0, cy = 0, tx = 0, ty = 0

  function measure() {
    const m = innerWidth <= 749
    if (W && m !== mobile) {
      cur = target; vel = 0
      bodies.forEach((s) => { s.goal = wrap(s.a - target, N); s.x = s.g = s.goal; s.v = 0; s.trip = false })
    }
    mobile = m; ring = !m
    const r = stage.getBoundingClientRect()
    W = r.width; H = r.height
    fs = ring ? 1.08 : 1
    const modelH = ring ? Math.max(200, Math.round((H - 34 - 18) / fs)) : Math.max(200, Math.round(H - 24 - 18))
    stage.style.setProperty('--model-h', `${modelH}px`)
    stage.style.setProperty('--fs', String(fs))
    stage.style.setProperty('--hx', `${ring ? 0.5 * W : 0.3 * W}px`)
    stage.style.setProperty('--hy', `${ring ? 34 : 22}px`)
    bodies.forEach((s) => { s.w = s.el.offsetWidth })
    unit = ring ? Math.max(120, 0.3 * W) : Math.max(90, W * 0.32 * 1.6)
    if (still) render()
  }

  function put(s: Body, x: number, b: number, sc: number, op: number, bl: number, z: number) {
    const hw = (s.w * sc) / 2
    if (x + hw < -4 || x - hw > W + 4) op = 0
    const st = s.el.style
    st.transform = `translate3d(${x.toFixed(2)}px,${(-b).toFixed(2)}px,0) translateX(-50%) scale(${sc.toFixed(4)})`
    st.opacity = op.toFixed(3)
    st.zIndex = String(z)
    st.visibility = op < 0.01 ? 'hidden' : ''
    st.pointerEvents = op < 0.5 ? 'none' : ''
    const r = Math.round(bl * 10) / 10
    if (r !== s.blur) { s.blur = r; st.filter = r > 0.05 ? `blur(${r}px)` : '' }
  }

  function render() {
    if (ring) {
      const cxp = 0.5 * W, R = 0.62 * W, P = 1.65 * W, floor = H - 34, hor = 0.36 * H, step = (2 * Math.PI) / N
      for (const s of bodies) {
        let phi = ((s.a - cur) * step) % (2 * Math.PI)
        if (phi > Math.PI) phi -= 2 * Math.PI
        if (phi <= -Math.PI) phi += 2 * Math.PI
        const persp = P / (P + R * (1 - Math.cos(phi))), sl = Math.abs(phi) / step
        const scale = persp * (1 + (fs - 1) * clamp(1 - sl, 0, 1))
        let op = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1)
        if (still && sl < 0.02) op = 0 // the matching hero stands here at rest
        put(s, cxp + R * Math.sin(phi) * persp, H - (hor + (floor - hor) * persp), scale, op, sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5), Math.round(scale * 1000))
      }
      return
    }
    const ax = 0.3, ay = 22, sx = 0.32, sy = 22, sr = 0.76, ex = 0.55, d = 4
    for (const s of bodies) {
      let k = s.x, e = -1
      if (s.trip) {
        const u = clamp(Math.abs(s.x - s.from) / (Math.abs(s.goal - s.from) || 1), 0, 1)
        if (s.goal > s.from) { if (u < 0.5) e = 2 * u * 1.4; else k = s.goal + 2 * (1 - u) }
        else if (u < 0.5) k = s.from + 2 * u
        else e = 2 * (1 - u) * 1.4
      } else if (k < 0) e = Math.min(-k, 1.4)
      if (e >= 0) { put(s, W * (ax - ex * e), ay - 22 * e, 1 + 0.14 * e, Math.max(0, 1 - 1.05 * e), 4 * Math.min(e, 1), 1100); continue }
      let op = k <= d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (d - k))
      if (still && Math.abs(k) < 0.02) op = 0
      put(s, W * (ax + sx * k), ay + sy * k, Math.pow(sr, k), op, Math.min(0.9 * k, 3.2), 1000 - Math.round(10 * k))
    }
  }

  function stepLine(dt: number) {
    let moving = false
    for (const s of bodies) {
      const goal = wrap(s.a - target, N)
      if (Math.abs(goal - s.goal) > N / 2) { s.trip = true; s.from = s.x }
      s.goal = goal
      if (reduce) { s.x = s.g = goal; s.v = 0; s.trip = false; continue }
      const tau = dragging ? 0.016 : s.trip ? 0.1 : 0.03 + LAG * Math.min(goal, 4)
      s.g += (goal - s.g) * (1 - Math.exp(-dt / tau))
      for (let i = 0; i < 3; i++) { s.v += (-K * (s.x - s.g) - C * s.v) * (dt / 3); s.x += s.v * (dt / 3) }
      if (s.trip && Math.abs(s.x - goal) < 0.02) s.trip = false
      if (Math.abs(s.x - goal) < 0.0006 && Math.abs(s.v) < 0.0006 && Math.abs(s.g - goal) < 0.0006) { s.x = s.g = goal; s.v = 0 } else moving = true
    }
    return moving
  }

  function tick(t: number) {
    raf = 0
    const dt = last ? Math.min(0.034, (t - last) / 1000) : 1 / 60
    last = t
    let moving: boolean
    if (ring) {
      if (reduce) { cur = target; vel = 0; moving = false }
      else {
        for (let i = 0; i < 3; i++) { vel += (-K * (cur - target) - C * vel) * (dt / 3); cur += vel * (dt / 3) }
        moving = !(Math.abs(cur - target) <= 0.0005 && Math.abs(vel) <= 0.0005)
        if (!moving) { cur = target; vel = 0 }
      }
    } else moving = stepLine(dt)
    moving = moving || dragging
    setStill(!moving)
    render()
    if (moving) kick(); else last = 0
  }
  function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick) }
  function setStill(v: boolean) { if (still === v) return; still = v; root.classList.toggle('is-still', v) }

  function rank(a: number) {
    let k = wrap(Math.round(a - target), N)
    if (ring && k > N / 2) k -= N
    return k
  }
  function setIndex(i: number, silent = false) {
    i = wrap(i, n)
    bodies.forEach((s) => {
      const k = rank(s.a), open = k !== 0 && Math.abs(k) <= (ring ? 2 : 3)
      const hit = s.el.querySelector<HTMLElement>('[data-hit]')
      if (hit) hit.tabIndex = open ? 0 : -1
      if (open) s.el.removeAttribute('aria-hidden'); else s.el.setAttribute('aria-hidden', 'true')
    })
    kick()
    if (i === index && !silent) return
    index = i
    o.onIndex(i)
    if (!silent && !reduce) { stage.classList.remove('is-sweep'); void stage.offsetWidth; stage.classList.add('is-sweep') }
    restartBar()
  }
  function moveTo(T: number) { target = T; setStill(false); setIndex(T); kick() }

  function restartBar() {
    clearTimeout(timer)
    const ticks = root.querySelectorAll<HTMLElement>('[data-tick]')
    ticks.forEach((t) => t.classList.remove('is-run'))
    if (!playing || !o.speed) return
    const t = ticks[index]
    if (t) { void t.offsetWidth; t.classList.add('is-run') }
    timer = window.setTimeout(() => {
      const f = o.flags.current
      if (playing && visible && !dragging && !document.hidden && !f.hover && !f.zoomed && !f.engaged) moveTo(Math.round(target) + 1)
      else restartBar()
    }, o.speed)
  }
  function play(v: boolean) { playing = v; o.onPlaying(v); restartBar() }

  // Drag / swipe
  on<PointerEvent>(stage, 'pointerdown', (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || o.flags.current.zoomed) return
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: target, s: [{ x: e.clientX, time: e.timeStamp }], drag: false }
  })
  const end = (e: PointerEvent) => {
    const p = ptr
    if (!p || e.pointerId !== p.id) return
    ptr = null
    if (!p.drag) return
    dragging = false
    root.classList.remove('is-dragging')
    suppress = performance.now() + 60
    const a = p.s[0], b = p.s[p.s.length - 1]
    const vx = b.time > a.time ? (b.x - a.x) / (b.time - a.time) : 0
    const dx = b.x - p.x, from = Math.round(p.t)
    if (mobile) moveTo(Math.abs(dx) > 30 || Math.abs(vx) > 0.3 ? from - (dx > 0 ? 1 : -1) : from)
    else {
      let i = Math.round(target - (vx * 160) / unit)
      if (i === from && Math.abs(vx) > 0.3) i = from - Math.sign(vx)
      moveTo(clamp(i, from - 2, from + 2))
    }
  }
  on<PointerEvent>(stage, 'pointermove', (e) => {
    moveCursor(e)
    const p = ptr
    if (!p || e.pointerId !== p.id) return
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { end(e); return }
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (!p.drag) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
        p.drag = true; dragging = true
        root.classList.add('is-dragging')
        cursor?.classList.remove('is-link', 'is-view')
        try { stage.setPointerCapture(p.id) } catch { /* pointer already gone */ }
        setStill(false)
      } else { if (Math.abs(dy) > 10) ptr = null; return }
    }
    p.s.push({ x: e.clientX, time: e.timeStamp })
    if (p.s.length > 6) p.s.shift()
    target = p.t - dx / unit
    kick()
  })
  on<PointerEvent>(stage, 'pointerup', end)
  on<PointerEvent>(stage, 'pointercancel', end)
  on<MouseEvent>(root, 'click', (e) => { if (performance.now() < suppress) { e.preventDefault(); e.stopPropagation() } }, { capture: true })
  // Trackpad horizontal swipe
  let acc = 0, lock = 0
  on<WheelEvent>(stage, 'wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    e.preventDefault()
    if (performance.now() < lock) return
    acc += e.deltaX
    if (Math.abs(acc) > 45) { moveTo(Math.round(target) + (acc > 0 ? 1 : -1)); acc = 0; lock = performance.now() + 520 }
  }, { passive: false })
  on<KeyboardEvent>(stage, 'keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(Math.round(target) + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(Math.round(target) - 1) }
  })

  // Custom "Drag / View" cursor with inertia, precise pointers only
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  if (fine && cursor) root.classList.add('has-cursor')
  function moveCursor(e: PointerEvent) {
    if (!fine || !cursor || e.pointerType !== 'mouse') return
    const r = stage.getBoundingClientRect()
    tx = e.clientX - r.left; ty = e.clientY - r.top
    if (!cursor.classList.contains('is-on')) { cx = tx; cy = ty; cursor.classList.add('is-on') }
    const t = e.target as HTMLElement
    cursor.classList.toggle('is-view', !dragging && !!t.closest('[data-zoom]'))
    cursor.classList.toggle('is-link', !dragging && !!t.closest('[data-hit]'))
    if (!craf) craf = requestAnimationFrame(cursorStep)
  }
  function cursorStep() {
    craf = 0
    const f = reduce ? 1 : 0.18
    cx += (tx - cx) * f; cy += (ty - cy) * f
    cursor!.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`
    if (Math.hypot(tx - cx, ty - cy) >= 0.2) craf = requestAnimationFrame(cursorStep)
  }
  on(stage, 'pointerleave', () => cursor?.classList.remove('is-on', 'is-link', 'is-view'))

  // Lifecycle
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; kick() }, { threshold: 0 })
  io.observe(root)
  const ro = new ResizeObserver(() => { measure(); kick() })
  ro.observe(stage)
  on(document, 'visibilitychange', () => { kick(); restartBar() })
  measure()
  bodies.forEach((s) => { s.goal = wrap(s.a - target, N); s.x = s.g = s.goal + START })
  setIndex(0, true)
  if (o.speed && !reduce) play(true)

  return {
    index: () => index,
    next: () => moveTo(Math.round(target) + 1),
    prev: () => moveTo(Math.round(target) - 1),
    go(i: number) { let d = wrap(i - index, n); if (d > n / 2) d -= n; moveTo(Math.round(target) + d) },
    clickBody(a: number) { const k = rank(a); if (k !== 0 && Math.abs(k) < N / 2) moveTo(Math.round(target) + k); else o.onOpen() },
    toggle() { if (!playing) o.flags.current.engaged = false; play(!playing) },
    engage() { o.flags.current.engaged = true; if (playing) play(false) },
    restartBar,
    destroy() { ac.abort(); cancelAnimationFrame(raf); cancelAnimationFrame(craf); clearTimeout(timer); io.disconnect(); ro.disconnect() },
  }
}
