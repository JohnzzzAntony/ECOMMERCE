'use client'
// Click-to-edit editor for page HTML (imported templates included). The page renders in a sandboxed
// frame with its styles but without its scripts (they would rewrite the DOM we save). Click any text
// to type over it; select any element to change its image, link, colors, size, or to duplicate,
// move or remove it. The frame's DOM is the working copy; every change is serialized back to HTML.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { useStylesheet } from '@/frontend/components/theme/html-content'
import { styleText } from '@/shared/theme'
import { ImageUpload } from './shared'

const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi
const PLACEHOLDER = /<template data-nx-script="(\d+)"><\/template>/g

interface Selection {
  tag: string
  label: string
  src: string | null
  alt: string
  href: string | null
  color: string
  bg: string
  bgImage: string
  fontSize: number
  canParent: boolean
}

type Command =
  | { cmd: 'attr'; name: string; value: string }
  | { cmd: 'style'; prop: string; value: string }
  | { cmd: 'remove' | 'duplicate' | 'up' | 'down' | 'parent' }

// Runs inside the frame (opaque origin; talks to the editor only through postMessage).
const EDITOR_SCRIPT = `(function () {
  var sel = null, hover = null, timer = 0;
  var post = function (m) { m.__nxEdit = 1; parent.postMessage(m, '*') };
  var TEXT = /^(H[1-6]|P|SPAN|A|LI|BUTTON|LABEL|SMALL|STRONG|EM|B|I|U|TD|TH|BLOCKQUOTE|FIGCAPTION|DT|DD|CITE|Q|DIV|SUP|SUB|MARK)$/;
  var hasText = function (el) { for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) return true } return false };
  var hex = function (c) { var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(c || ''); if (!m || m[4] === '0') return ''; return '#' + [m[1], m[2], m[3]].map(function (x) { return (+x).toString(16).padStart(2, '0') }).join('') };
  var serialize = function () {
    var body = document.body.cloneNode(true), own = body.querySelector('#nx-editor');
    if (own) own.remove();
    body.querySelectorAll('[data-nx-sel],[data-nx-hover],[data-nx-ce]').forEach(function (el) {
      el.removeAttribute('data-nx-sel'); el.removeAttribute('data-nx-hover');
      if (el.hasAttribute('data-nx-ce')) { el.removeAttribute('data-nx-ce'); el.removeAttribute('contenteditable') }
      if (el.getAttribute('style') === '') el.removeAttribute('style');
    });
    return body.innerHTML;
  };
  var changed = function () { clearTimeout(timer); timer = setTimeout(function () { post({ type: 'html', html: serialize() }) }, 250) };
  var info = function (el) {
    var cs = getComputedStyle(el), a = el.closest('a'), cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    var bgi = /url\\(["']?([^"')]+)/.exec(el.style.backgroundImage || cs.backgroundImage || '');
    return { tag: el.tagName.toLowerCase(), label: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : ''),
      src: el.tagName === 'IMG' ? el.getAttribute('src') || '' : null, alt: el.getAttribute('alt') || '',
      href: a ? a.getAttribute('href') || '' : null, color: hex(cs.color), bg: hex(cs.backgroundColor), bgImage: bgi ? bgi[1] : '',
      fontSize: Math.round(parseFloat(cs.fontSize) || 0), canParent: !!el.parentElement && el.parentElement !== document.body };
  };
  var select = function (el) {
    if (sel && sel !== el && sel.hasAttribute('data-nx-ce')) { sel.removeAttribute('contenteditable'); sel.removeAttribute('data-nx-ce') }
    if (sel) sel.removeAttribute('data-nx-sel');
    sel = el && el !== document.body && el !== document.documentElement ? el : null;
    if (!sel) { post({ type: 'select', info: null }); return }
    sel.setAttribute('data-nx-sel', '');
    if (TEXT.test(sel.tagName) && hasText(sel) && !sel.isContentEditable) { sel.setAttribute('contenteditable', 'true'); sel.setAttribute('data-nx-ce', ''); sel.focus() }
    post({ type: 'select', info: info(sel) });
  };
  window.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (!e.target.closest('[data-nx-ce]') || e.target.closest('[data-nx-ce]') !== sel) select(e.target) }, true);
  window.addEventListener('submit', function (e) { e.preventDefault() }, true);
  document.addEventListener('mouseover', function (e) { if (hover) hover.removeAttribute('data-nx-hover'); hover = e.target; if (hover !== document.body) hover.setAttribute('data-nx-hover', '') });
  document.addEventListener('input', changed);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { select(null); if (document.activeElement) document.activeElement.blur() } });
  window.addEventListener('message', function (e) {
    var m = e.data; if (e.source !== parent || !m || m.__nxCmd !== 1 || !sel) return;
    var el = sel;
    if (m.cmd === 'attr') { var t = m.name === 'href' ? el.closest('a') || el : el; if (m.value === '' && m.name !== 'alt') t.removeAttribute(m.name); else t.setAttribute(m.name, m.value); if (m.name === 'src') t.removeAttribute('srcset') }
    else if (m.cmd === 'style') { if (m.value) el.style.setProperty(m.prop, m.value); else el.style.removeProperty(m.prop) }
    else if (m.cmd === 'remove') { select(el.parentElement); el.remove() }
    else if (m.cmd === 'duplicate') { var c = el.cloneNode(true); el.after(c); select(c) }
    else if (m.cmd === 'up' && el.previousElementSibling) el.previousElementSibling.before(el);
    else if (m.cmd === 'down' && el.nextElementSibling) el.nextElementSibling.after(el);
    else if (m.cmd === 'parent') { select(el.parentElement); return }
    if (sel) post({ type: 'select', info: info(sel) });
    changed();
  });
})();`

// Without their scripts, scroll-reveal and slider libraries leave content hidden or stacked at 0×0;
// lay it out statically while editing (sliders show their slides one under another).
const EDITOR_CSS = `
.owl-carousel,.slick-slider,.swiper,.swiper-container,.flexslider .slides,.carousel-inner{display:block!important;visibility:visible!important;opacity:1!important}
.owl-carousel>*,.carousel-item,.swiper-slide,.flexslider .slides>li{display:block!important;opacity:1!important;transform:none!important}
.tp-banner-container,.tp-banner,.rev_slider_wrapper,.rev_slider{height:auto!important;max-height:none!important;overflow:visible!important}
.tp-banner>ul>li,.rev_slider>ul>li{position:relative!important;visibility:visible!important;opacity:1!important;list-style:none}
.tp-banner>ul>li>img,.rev_slider>ul>li>img{width:100%;height:auto}
.tp-caption{position:relative!important;left:auto!important;top:auto!important;visibility:visible!important;opacity:1!important;transform:none!important}
[data-nx-hover]{outline:1px dashed #0d9488!important;outline-offset:2px;cursor:pointer}
[data-nx-sel]{outline:2px solid #0d9488!important;outline-offset:2px}
[contenteditable]{cursor:text}
body *{pointer-events:auto!important}
.wow,[data-aos],.reveal,.animate__animated,.animated{visibility:visible!important;opacity:1!important;transform:none!important;animation:none!important}
`

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function VisualEditor({ html, css = '', themeCssUrl = '', bodyClass = '', onChange }: {
  html: string
  css?: string
  themeCssUrl?: string
  bodyClass?: string
  onChange: (html: string) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const emitted = useRef(html)
  const latestChange = useRef(onChange)
  latestChange.current = onChange
  const [seed, setSeed] = useState(html)
  const [history, setHistory] = useState<string[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const themeCss = useStylesheet(themeCssUrl)

  // Content changed outside the frame (code tab, undo): reload the frame with it.
  useEffect(() => { if (html !== emitted.current) { emitted.current = html; setSeed(html); setSelection(null) } }, [html])

  const scripts = useMemo(() => seed.match(SCRIPT) ?? [], [seed])
  const srcDoc = useMemo(() => {
    if (themeCss === null) return ''
    let i = 0
    const body = seed.replace(SCRIPT, () => `<template data-nx-script="${i++}"></template>`)
    return [
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      themeCss ? `<style>${styleText(themeCss)}</style>` : '',
      `<style>${styleText(css)}</style><style>${EDITOR_CSS}</style>`,
      `</head><body class="${attr(bodyClass)}">${body}<script id="nx-editor">${EDITOR_SCRIPT}</script></body></html>`,
    ].join('')
  }, [seed, css, bodyClass, themeCss])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || e.data.__nxEdit !== 1) return
      if (e.data.type === 'select') setSelection(e.data.info)
      if (e.data.type === 'html' && typeof e.data.html === 'string') {
        // Put the page's own scripts back where they were.
        const next = e.data.html.replace(PLACEHOLDER, (_: string, n: string) => scripts[Number(n)] ?? '').trim()
        setHistory((h) => [...h.slice(-49), emitted.current])
        emitted.current = next
        latestChange.current(next)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [scripts])

  const send = (command: Command) => frame.current?.contentWindow?.postMessage({ __nxCmd: 1, ...command }, '*')
  const undo = () => {
    const prev = history.at(-1)
    if (prev === undefined) return
    setHistory((h) => h.slice(0, -1))
    latestChange.current(prev) // the effect above reloads the frame with it
  }

  const s = selection
  return (
    <div className="flex h-[68vh] gap-3">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white">
        {srcDoc
          ? <iframe ref={frame} title="Visual editor" srcDoc={srcDoc} sandbox="allow-scripts" className="h-full w-full border-0" />
          : <div className="h-full" aria-busy="true" />}
      </div>
      <aside className="w-64 shrink-0 space-y-4 overflow-y-auto text-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Click to select · type to edit text</span>
          <Button variant="ghost" size="icon" className="size-7" disabled={!history.length} onClick={undo} aria-label="Undo" title="Undo"><Undo2 className="size-4" /></Button>
        </div>
        {!s ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Select any text, image, button or block in the page. Text is edited in place; images, links, colors and layout here.
            Template scripts (sliders, animations) are paused while editing.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-[11px]">{s.label}</code>
              <Button variant="ghost" size="icon" className="size-7" disabled={!s.canParent} onClick={() => send({ cmd: 'parent' })} title="Select parent" aria-label="Select parent"><CornerLeftUp className="size-3.5" /></Button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <Button variant="outline" size="icon" className="w-full" onClick={() => send({ cmd: 'up' })} title="Move up" aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
              <Button variant="outline" size="icon" className="w-full" onClick={() => send({ cmd: 'down' })} title="Move down" aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
              <Button variant="outline" size="icon" className="w-full" onClick={() => send({ cmd: 'duplicate' })} title="Duplicate" aria-label="Duplicate"><Copy className="size-3.5" /></Button>
              <Button variant="outline" size="icon" className="w-full text-red-600" onClick={() => send({ cmd: 'remove' })} title="Remove" aria-label="Remove"><Trash2 className="size-3.5" /></Button>
            </div>
            {s.src !== null && (
              <>
                <ImageUpload label="Image" value={s.src} folder="pages" onChange={(url) => send({ cmd: 'attr', name: 'src', value: url })} />
                <Field label="Alt text" value={s.alt} onCommit={(v) => send({ cmd: 'attr', name: 'alt', value: v })} />
              </>
            )}
            {s.href !== null && <Field label="Link" value={s.href} placeholder="/?page=about or https://…" onCommit={(v) => send({ cmd: 'attr', name: 'href', value: v })} />}
            {s.src === null && (<>
            <div className="grid grid-cols-2 gap-2">
              <Color label="Text color" value={s.color} onChange={(v) => send({ cmd: 'style', prop: 'color', value: v })} />
              <Color label="Background" value={s.bg} onChange={(v) => send({ cmd: 'style', prop: 'background-color', value: v })} />
            </div>
            <Field label="Font size (px)" value={s.fontSize ? String(s.fontSize) : ''} onCommit={(v) => send({ cmd: 'style', prop: 'font-size', value: /^\d+(\.\d+)?$/.test(v) ? `${v}px` : '' })} />
            <ImageUpload label="Background image" value={s.bgImage} folder="pages"
                onChange={(url) => send({ cmd: 'style', prop: 'background-image', value: url ? `url("${url.replace(/"/g, '%22')}")` : '' })} />
            </>)}
          </>
        )}
      </aside>
    </div>
  )
}

/** Text input that applies on Enter or blur, so the frame isn't rewritten on every keystroke. */
function Field({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the selected element
  useEffect(() => setText(value), [value])
  const commit = () => { if (text !== value) onCommit(text.trim()) }
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className="h-8 text-xs" />
    </div>
  )
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" aria-label={label} />
    </div>
  )
}
