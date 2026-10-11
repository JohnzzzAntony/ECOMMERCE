'use client'
// Rendering admin/theme-authored HTML.
//  - SafeHtml: inside the store's own layout and styles, sanitized with DOMPurify.
//  - IsolatedFrame: imported template pages in a sandboxed iframe with their own CSS and scripts,
//    so template code and styles can't reach the store, and the store's styles can't break the template.
import { useEffect, useMemo, useRef, useState } from 'react'
import { followHref } from '@/frontend/lib/theme'
import { styleText } from '@/shared/theme'

/** Route clicks on in-site links through the SPA instead of reloading the page. */
function handleLinkClick(event: MouseEvent | React.MouseEvent, scrollToHash: (id: string) => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
  const anchor = (event.target as Element | null)?.closest?.('a')
  const href = anchor?.getAttribute('href')
  if (!anchor || !href) return
  if (href.startsWith('#')) {
    event.preventDefault()
    if (href.length > 1) scrollToHash(decodeURIComponent(href.slice(1)))
    return
  }
  if (/^(mailto|tel):/i.test(href)) return
  if (/^(https?:)?\/\//i.test(href) && new URL(href, window.location.origin).origin !== window.location.origin) {
    event.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  if (anchor.getAttribute('target') === '_blank') return
  if (followHref(href)) event.preventDefault()
}

export function SafeHtml({ html, css, className = 'page-content' }: { html: string; css?: string; className?: string }) {
  // DOMPurify needs a DOM, so sanitize after mount (also keeps server and client markup identical).
  const [clean, setClean] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    import('dompurify').then(({ default: DOMPurify }) => {
      if (cancelled) return
      setClean(DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'loading'],
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
      }))
    })
    return () => { cancelled = true }
  }, [html])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: styleText(css) }} /> : null}
      {clean === null
        ? <div className="min-h-24" aria-busy="true" />
        : <div className={className} onClick={(e) => handleLinkClick(e, scrollTo)} dangerouslySetInnerHTML={{ __html: clean }} />}
    </>
  )
}

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Name of every theme frame; a store page loaded inside one hands its URL to the parent (see app/layout.tsx). */
export const THEME_FRAME_NAME = 'theme-frame'

/**
 * Runs first inside every isolated frame. The frame has its own opaque origin, so template scripts
 * work but can't read the store's cookies, storage or DOM. This bridge:
 *  - gives template scripts in-memory localStorage/sessionStorage (real storage is blocked there),
 *  - sends link clicks and script-driven navigations to the store (which routes /?page=… in-app);
 *    if a template script still navigates the frame away, the store follows the last clicked link,
 *  - reports the content height so embedded pages can grow to fit.
 */
const FRAME_BRIDGE = `(function () {
  var post = function (m) { m.__themeFrame = 1; parent.postMessage(m, '*') };
  var mem = function () { var d = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null }, setItem: function (k, v) { d[k] = String(v) }, removeItem: function (k) { delete d[k] }, clear: function () { d = {} }, key: function (i) { return Object.keys(d)[i] || null }, get length() { return Object.keys(d).length } } };
  ['localStorage', 'sessionStorage'].forEach(function (n) { try { window[n].getItem('x') } catch (e) { try { Object.defineProperty(window, n, { value: mem(), configurable: true }) } catch (_) {} } });
  var auto = document.documentElement.getAttribute('data-frame') === 'auto';
  // Report every link click before the template's own handlers run: page-transition scripts cancel
  // the click and change location later, which the store can't see (the frame is another origin).
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    var href = a ? a.getAttribute('href') || '' : '';
    if (href && href.charAt(0) !== '#' && !/^javascript:/i.test(href)) post({ type: 'intent', href: href, newTab: a.getAttribute('target') === '_blank' });
  }, true);
  window.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^javascript:/i.test(href)) return;
    if (href.charAt(0) === '#') {
      if (!auto || href.length < 2) return;
      var el = document.getElementById(decodeURIComponent(href.slice(1)));
      if (el) { e.preventDefault(); post({ type: 'scroll', top: el.getBoundingClientRect().top + window.scrollY }) }
      return;
    }
    e.preventDefault();
    post({ type: 'navigate', href: href, newTab: a.getAttribute('target') === '_blank' });
  });
  if (window.navigation) window.navigation.addEventListener('navigate', function (e) {
    if (!e.cancelable || e.hashChange || e.downloadRequest || (e.destination && e.destination.sameDocument)) return;
    e.preventDefault();
    post({ type: 'navigate', href: e.destination.url });
  });
  var h = function () { post({ type: 'height', height: document.documentElement.scrollHeight }) };
  window.addEventListener('load', h);
  if (window.ResizeObserver) new ResizeObserver(h).observe(document.documentElement);
})();`

// Template CSS is fetched by the store page (same origin, HTTP-cached by its versioned URL) and
// inlined: the frame's opaque origin can't load it as a <link>. One download serves every page.
const cssCache = new Map<string, Promise<string>>()
export function useStylesheet(url: string) {
  const [loaded, setLoaded] = useState<{ url: string; css: string } | null>(null)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    let pending = cssCache.get(url)
    if (!pending) {
      pending = fetch(url).then((r) => (r.ok ? r.text() : ''))
      pending.catch(() => cssCache.delete(url))
      cssCache.set(url, pending)
    }
    pending.then((css) => { if (!cancelled) setLoaded({ url, css }) }).catch(() => { if (!cancelled) setLoaded({ url, css: '' }) })
    return () => { cancelled = true }
  }, [url])
  if (!url) return ''
  return loaded?.url === url ? loaded.css : null
}

function followFrameLink(href: string, newTab = false) {
  if (/^(mailto|tel):/i.test(href)) { window.location.href = href; return }
  let url: URL
  try { url = new URL(href, window.location.origin) } catch { return }
  if (url.origin !== window.location.origin || newTab) window.open(url.toString(), '_blank', 'noopener,noreferrer')
  else followHref(url.toString())
}

export function IsolatedFrame({ html, css = '', themeCssUrl = '', bodyClass = '', fullHeight = false, title }: {
  html: string
  css?: string
  /** Template stylesheet URL (cached by the browser across pages). */
  themeCssUrl?: string
  bodyClass?: string
  /** Fill the viewport and scroll inside the frame (for templates that replace the whole page). */
  fullHeight?: boolean
  title: string
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [generation, setGeneration] = useState(0) // bumped to restore the frame after it navigated away
  const themeCss = useStylesheet(themeCssUrl)
  const srcDoc = useMemo(() => themeCss === null ? '' : [
    `<!doctype html><html data-frame="${fullHeight ? 'full' : 'auto'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<script>${FRAME_BRIDGE}</script>`,
    themeCss ? `<style>${styleText(themeCss)}</style>` : '',
    `<style>${styleText(css)}</style>`,
    `</head><body class="${attr(bodyClass)}">${html}</body></html>`,
  ].join(''), [html, css, themeCss, bodyClass, fullHeight])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    // Content sized in vh grows with the frame itself; two equal consecutive growth steps mean
    // that feedback loop, so keep the first measured height.
    let first = 0
    let lastDelta = 0
    let frozen = false
    let intent: { href: string; newTab?: boolean; at: number } | null = null
    const onLoad = () => {
      // A load after a link click means a template script took the frame away from the template.
      // Follow the link the visitor clicked and put the template back in place.
      if (!intent || Date.now() - intent.at > 15_000) return
      followFrameLink(intent.href, intent.newTab)
      intent = null
      setGeneration((g) => g + 1)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data || e.data.__themeFrame !== 1) return
      const msg = e.data as { type: string; href?: string; newTab?: boolean; height?: number; top?: number }
      if (msg.type === 'intent' && typeof msg.href === 'string') intent = { href: msg.href, newTab: msg.newTab, at: Date.now() }
      else if (msg.type === 'navigate' && typeof msg.href === 'string') { intent = null; followFrameLink(msg.href, msg.newTab) }
      else if (msg.type === 'scroll' && typeof msg.top === 'number') {
        window.scrollTo({ top: frame.getBoundingClientRect().top + window.scrollY + msg.top - 80, behavior: 'smooth' })
      } else if (msg.type === 'height' && !fullHeight && !frozen && typeof msg.height === 'number') {
        const current = frame.offsetHeight
        const delta = Math.round(msg.height) - current
        if (Math.abs(delta) < 2) return
        if (delta > 0 && delta === lastDelta) { frame.style.height = `${first}px`; frozen = true; return }
        lastDelta = delta
        if (!first) first = Math.round(msg.height)
        frame.style.height = `${Math.round(msg.height)}px`
      }
    }
    window.addEventListener('message', onMessage)
    frame.addEventListener('load', onLoad)
    return () => { window.removeEventListener('message', onMessage); frame.removeEventListener('load', onLoad) }
  }, [srcDoc, fullHeight, generation])

  if (!srcDoc) return <div className="w-full" style={{ height: fullHeight ? '100vh' : '60vh' }} aria-busy="true" />
  return (
    <iframe
      key={generation}
      ref={ref}
      name={THEME_FRAME_NAME}
      title={title}
      srcDoc={srcDoc}
      // allow-scripts without allow-same-origin: template JavaScript runs in its own opaque origin and
      // cannot touch the store page, its cookies or storage. Navigation goes through FRAME_BRIDGE.
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="block w-full border-0"
      style={{ height: '100vh' }}
    />
  )
}
