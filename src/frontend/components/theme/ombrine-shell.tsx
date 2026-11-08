'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Moon, Sun } from 'lucide-react'
import { useHydrated } from '@/frontend/hooks/use-hydrated'
import { useStore } from '@/frontend/store/use-store'
import { effectivePrice } from '@/shared/storefront'
import { salonCurrency, salonPrice } from '@/shared/ombrine'
import { resolveLink, styleText, themeVariablesCss, type MenuItem, type StorefrontTheme } from '@/shared/theme'
import { useOmbrineMotion } from './use-ombrine-motion'
import './ombrine.css'

export function SalonDialog({ children, label, onClose, kind }: { children: ReactNode; label: string; onClose: () => void; kind: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={ref} aria-label={label} data-lenis-prevent className={`om-dialog om-${kind}`}
    onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="om-dialog-inner">{children}</div>
  </dialog>
}

function SalonLink({ item, onClick }: { item: MenuItem; onClick?: () => void }) {
  const target = resolveLink(item.link)
  let href: string | undefined
  if (target.kind === 'href') href = target.href
  else if (target.kind === 'mega') href = '/collection'
  else if (target.kind === 'view') {
    const params = target.params
    switch (target.view) {
      case 'home': href = '/'; break
      case 'cart': href = '/cart'; break
      case 'products': href = '/collection'; break
      case 'offers': href = '/collection?sale=1'; break
      case 'about': href = '/atelier'; break
      case 'blog': href = '/journal'; break
      case 'shipping-info': href = '/pages/ombrine-delivery'; break
      case 'products-category': href = '/collections/' + encodeURIComponent(params?.categorySlug || 'all'); break
      case 'products-collection': href = '/collections/' + encodeURIComponent(params?.collectionSlug || 'all'); break
      case 'products-brand': href = '/collection?brand=' + encodeURIComponent(params?.brandSlug || ''); break
      case 'product-detail': if (params?.slug) href = '/products/' + encodeURIComponent(params.slug); break
      case 'page': if (params?.slug) href = '/pages/' + encodeURIComponent(params.slug); break
    }
  }
  return href ? <Link href={href} onClick={onClick}>{item.label}</Link> : <span>{item.label}</span>
}

function SalonSearch() {
  return <details className="om-search-control">
    <summary>Search</summary>
    <form action="/collection" className="om-search">
      <input type="search" name="q" aria-label="Search products and looks" placeholder="Search products and looks" required maxLength={100} />
      <button type="submit" aria-label="Submit search">→</button>
    </form>
  </details>
}

export function OmbrineShell({ theme, children, footer = true }: { theme: StorefrontTheme; children: ReactNode; footer?: boolean }) {
  const [menu, setMenu] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const menuPanel = useRef<HTMLDivElement>(null)
  const mounted = useHydrated()
  const night = useStore((s) => s.salonDark) && mounted
  const setNight = useStore((s) => s.setSalonDark)
  const cart = useStore((s) => s.salonBag)
  const bag = useStore((s) => s.cartDrawerOpen)
  const setBag = useStore((s) => s.setCartDrawerOpen)
  const count = mounted ? cart.reduce((sum, line) => sum + line.quantity, 0) : 0
  const logo = String(theme.settings.logo_text || 'Ombrine')
  const clientCare = theme.menus.footer.find((item) => item.id === 'delivery')
  const { root: motionRoot, curtain, navigate } = useOmbrineMotion(footer)
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setMenu(false)
      menuTrigger.current?.focus()
    }
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || menuPanel.current?.contains(e.target) || menuTrigger.current?.contains(e.target)) return
      setMenu(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menu])
  return (
    <div className="ombrine" data-appearance={night ? 'dark' : 'light'} ref={motionRoot} onClickCapture={navigate}>
      <style dangerouslySetInnerHTML={{ __html: styleText(themeVariablesCss(theme.schema, theme.settings).replace(/^:root/, '.ombrine') + '\n' + theme.css) }} />
      <a href="#om-main" className="om-skip">Skip to content</a>
      <header className="om-header" data-editorial={footer}>
        <div className="om-navigation">
          <button type="button" className="om-menu-toggle" ref={menuTrigger} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="om-navigation-menu" disabled={!mounted}>
            <span className="om-menu-icon" aria-hidden />{menu ? 'Close' : 'Menu'}
          </button>
          {menu && <div className="om-menu-flyout" id="om-navigation-menu" ref={menuPanel} data-lenis-prevent>
            <nav aria-label="Store"><ul>{theme.menus.main.map((item) => <li key={item.id}>
              <SalonLink item={item} onClick={() => setMenu(false)} />
              {item.children?.length ? <ul>{item.children.map((child) => <li key={child.id}><SalonLink item={child} onClick={() => setMenu(false)} /></li>)}</ul> : null}
            </li>)}</ul></nav>
            <div className="om-menu-utilities">
              <SalonSearch />
              {clientCare && <SalonLink item={{ ...clientCare, label: 'Client care' }} onClick={() => setMenu(false)} />}
              <button type="button" onClick={() => setNight(!night)}>{night ? 'Light appearance' : 'Dark appearance'}</button>
            </div>
          </div>}
        </div>
        {footer && <nav className="om-editorial-nav" aria-label="Store">{theme.menus.main.map((item) => <SalonLink key={item.id} item={item} />)}</nav>}
        <Link href="/" className="om-logo" aria-label={`${logo} home`}>{theme.settings.logo_url ? <img src={String(theme.settings.logo_url)} alt={logo} /> : logo}</Link>
        <div className="om-header-tools">
          {footer && <div className="om-editorial-tools">
            <SalonSearch />
            <button className="om-theme-switch" type="button" aria-label={night ? 'Light appearance' : 'Dark appearance'} onClick={() => setNight(!night)}>
              <span data-selected={!night}><Sun size={14} aria-hidden /></span><span data-selected={night}><Moon size={14} aria-hidden /></span>
            </button>
          </div>}
          <button type="button" className="om-bag-toggle" data-filled={count > 0} onClick={() => { setMenu(false); setBag(true) }} aria-haspopup="dialog" disabled={!mounted}>Bag <span>{count}</span></button>
        </div>
      </header>
      <main id="om-main">{children}</main>
      {footer && <footer className="om-footer"><Link href="/" className="om-wordmark">{logo}</Link><nav aria-label="Footer">{theme.menus.footer.map((item) => <SalonLink key={item.id} item={item} />)}</nav></footer>}
      <div className="om-curtain" ref={curtain} aria-hidden="true"><span>{logo}</span></div>
      {mounted && bag && <SalonDialog label="Your bag" kind="bag" onClose={() => setBag(false)}>
        <BagContents theme={theme} onClose={() => setBag(false)} />
      </SalonDialog>}
    </div>
  )
}

export function BagContents({ theme, onClose }: { theme: StorefrontTheme; onClose?: () => void }) {
  const cart = useStore((s) => s.salonBag)
  const remove = useStore((s) => s.removeFromCart)
  const quantity = useStore((s) => s.updateCartQty)
  const ready = useHydrated()
  const lines = ready ? cart : []
  const count = lines.reduce((sum, item) => sum + item.quantity, 0)
  const total = lines.reduce((sum, item) => sum + effectivePrice(item.product) * item.quantity, 0)
  const price = (value: number) => salonPrice(value, salonCurrency(theme))
  return <>
    <div className="om-drawer-heading"><h2>Your bag <small>{count} {count === 1 ? 'piece' : 'pieces'}</small></h2>{onClose && <button type="button" onClick={onClose}>Close</button>}</div>
    <div className="om-bag-lines">
      {ready && !lines.length && <p>Your bag is waiting for its first piece.</p>}
      {lines.map(({ product, productId, size, quantity: qty }) => <article className="om-bag-line" key={productId}>
        <Link className="om-product-image" href={`/products/${product.slug}`} onClick={onClose}><img src={product.images[0]?.imageUrl || undefined} alt={product.name} /></Link>
        <div><Link className="om-piece-name" href={`/products/${product.slug}`} onClick={onClose}>{product.name}</Link>{size && <p className="om-muted">· {size}</p>}
          <div className="om-quantity"><button type="button" aria-label={`Decrease quantity of ${product.name}`} disabled={qty <= 1} onClick={() => quantity(productId, qty - 1, 'ombrine')}>−</button><span>{qty}</span><button type="button" aria-label={`Increase quantity of ${product.name}`} disabled={qty >= 99} onClick={() => quantity(productId, qty + 1, 'ombrine')}>+</button><button type="button" className="om-link" onClick={() => remove(productId, 'ombrine')}>Remove</button></div>
        </div>
        <span>{price(effectivePrice(product) * qty)}</span>
      </article>)}
    </div>
    <div className="om-bag-summary">
      <p><em>Subtotal</em><span>{price(total)}</span></p>
      {theme.settings.ombrine_bag_note && <div className="om-muted">{String(theme.settings.ombrine_bag_note)}</div>}
      {!!lines.length && <Link href="/checkout" className="om-primary" onClick={onClose}>Checkout</Link>}
      {onClose ? <button type="button" className="om-continue" onClick={onClose}>Continue shopping</button> : <Link className="om-continue" href="/">Continue shopping</Link>}
    </div>
  </>
}
