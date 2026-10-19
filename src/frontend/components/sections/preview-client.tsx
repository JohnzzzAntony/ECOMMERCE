'use client'
// Draft preview inside the admin editor's iframe. The editor posts section changes (postMessage, same origin);
// the preview re-renders at once and refreshes catalog data for data-bound sections in the background.
// Like Shopify's theme editor, the preview is interactive: hovering outlines a section or Figma layer, clicking
// selects it in the editor (links and widgets don't fire), and double-clicking a Figma text layer edits it in place.
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react'
import { SECTION_COMPONENTS } from './index'
import { baseCss } from './storefront-page'
import type { SectionProps } from './shared'
import type { RenderedPage } from '@/shared/storefront'
import type { SectionInstance, SectionType } from '@/shared/sections/registry'

const LAZY = Object.fromEntries(Object.entries(SECTION_COMPONENTS).map(([type, load]) => [type, lazy(load)])) as unknown as Record<SectionType, ComponentType<SectionProps>>

class SectionBoundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="border border-dashed border-red-300 p-4 text-sm text-red-700">“{this.props.name}” could not be displayed with these settings.</div> : this.props.children }
}

export type PreviewMessage = { type: 'nexecoms:preview'; sections: SectionInstance[]; selectedId?: string | null; selectedNodeId?: string | null }
/** Messages from the preview to the editor. */
export type PreviewEvent =
  | { type: 'nexecoms:preview-ready' }
  | { type: 'nexecoms:select'; sectionId: string; nodeId: string | null }
  | { type: 'nexecoms:edit-text'; sectionId: string; nodeId: string; text: string }

const toEditor = (msg: PreviewEvent) => window.parent?.postMessage(msg, window.location.origin)
const EDITING = '[contenteditable="true"],[contenteditable="plaintext-only"]'

export function PreviewClient({ initial, dataUrl }: { initial: RenderedPage; dataUrl: string }) {
  const [page, setPage] = useState(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hover, setHover] = useState<{ sid: string; nid: string | null } | null>(null)
  // Bumped after an inline text edit, so React re-creates the section instead of reconciling edited DOM.
  const [nonce, setNonce] = useState<Record<string, number>>({})
  const pending = useRef<AbortController | null>(null)
  const pickedHere = useRef(false)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const msg = e.data as PreviewMessage
      if (msg?.type !== 'nexecoms:preview' || !Array.isArray(msg.sections)) return
      setSelected(msg.selectedId ?? null)
      setSelectedNode(msg.selectedNodeId ?? null)
      setPage((p) => ({ ...p, sections: msg.sections.filter((s) => !s.hidden) }))
      pending.current?.abort()
      const ctrl = new AbortController()
      pending.current = ctrl
      fetch(dataUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections: msg.sections }), signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((rendered: RenderedPage | null) => { if (rendered) setPage((p) => ({ ...p, data: rendered.data })) })
        .catch(() => {})
    }
    window.addEventListener('message', onMessage)
    toEditor({ type: 'nexecoms:preview-ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [dataUrl])

  useEffect(() => {
    // Selected in the editor's sidebar: bring it into view (not when it was just clicked here).
    if (pickedHere.current) { pickedHere.current = false; return }
    if (!selected) return
    const section = document.querySelector(`[data-sid="${CSS.escape(selected)}"]`)
    const node = selectedNode ? section?.querySelector(`[data-nid="${CSS.escape(selectedNode)}"]`) : null
    ;(node ?? section)?.scrollIntoView({ behavior: 'smooth', block: node ? 'nearest' : 'center' })
  }, [selected, selectedNode])

  const target = (el: EventTarget | null) => {
    const start = el instanceof Element ? el : null
    const sectionEl = start?.closest<HTMLElement>('[data-sid]')
    if (!sectionEl) return null
    const nodeEl = start?.closest<HTMLElement>('[data-nid]')
    return { sid: sectionEl.dataset.sid!, nid: nodeEl && sectionEl.contains(nodeEl) ? nodeEl.dataset.nid! : null, nodeEl }
  }
  const onClickCapture = (e: MouseEvent) => {
    if ((e.target as Element).closest?.(EDITING)) return
    const t = target(e.target)
    if (!t) return
    e.preventDefault(); e.stopPropagation()
    pickedHere.current = true
    setSelected(t.sid); setSelectedNode(t.nid)
    toEditor({ type: 'nexecoms:select', sectionId: t.sid, nodeId: t.nid })
  }
  const onDoubleClick = (e: MouseEvent) => {
    const t = target(e.target)
    const el = t?.nodeEl
    if (!t?.nid || !el || el.dataset.kind !== 'text') return
    e.preventDefault()
    const before = el.innerText
    el.contentEditable = 'plaintext-only'
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'
    el.focus()
    document.getSelection()?.selectAllChildren(el)
    let cancelled = false
    const finish = () => {
      el.removeEventListener('blur', finish); el.removeEventListener('keydown', onKey)
      el.contentEditable = 'false'
      const text = el.innerText.replace(/\n$/, '')
      if (!cancelled && text !== before) toEditor({ type: 'nexecoms:edit-text', sectionId: t.sid, nodeId: t.nid!, text })
      setNonce((n) => ({ ...n, [t.sid]: (n[t.sid] ?? 0) + 1 }))
    }
    const onKey = (k: KeyboardEvent) => {
      if (k.key === 'Escape') { cancelled = true; el.blur() }
      else if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); el.blur() }
    }
    el.addEventListener('blur', finish); el.addEventListener('keydown', onKey)
  }
  const onMouseOver = (e: MouseEvent) => {
    const t = target(e.target)
    setHover((h) => (t ? (h?.sid === t.sid && h.nid === t.nid ? h : { sid: t.sid, nid: t.nid }) : null))
  }

  // Outlines: dashed on hover, solid on the selected layer (selected sections are outlined below).
  const sel = (sid: string, nid: string | null) => `[data-sid="${CSS.escape(sid)}"]${nid ? ` [data-nid="${CSS.escape(nid)}"]` : ''}`
  const outlineCss = [
    hover && !(hover.sid === selected && hover.nid === selectedNode) ? `${sel(hover.sid, hover.nid)}{outline:1px dashed #0ea5e9;outline-offset:-1px;cursor:pointer}` : '',
    selected && selectedNode ? `${sel(selected, selectedNode)}{outline:2px solid #0ea5e9;outline-offset:-2px}` : '',
    `${EDITING}{outline:2px solid #f59e0b!important;cursor:text}`,
  ].join('')

  const { tokens, fonts } = page
  const css = useMemo(() => baseCss({ tokens, fonts }), [tokens, fonts])
  const render = (list: SectionInstance[], first = false) => list.map((s, i) => {
    const C = LAZY[s.type]
    return (
      <div key={`${s.id}:${nonce[s.id] ?? 0}`} className={selected === s.id && !selectedNode ? 'outline outline-2 -outline-offset-2 outline-sky-500' : undefined}>
        <SectionBoundary name={s.type}><Suspense fallback={<div className="h-24 animate-pulse bg-black/5" />}><C section={s} data={page.data[s.id]} page={page} priority={first && i === 0} editing /></Suspense></SectionBoundary>
      </div>
    )
  })
  return (
    <div className="figma-store min-h-screen" onClickCapture={onClickCapture} onDoubleClick={onDoubleClick} onMouseOver={onMouseOver} onMouseLeave={() => setHover(null)}>
      <style>{css}</style>
      <style>{outlineCss}</style>
      {render(page.globals.announcement)}
      {render(page.globals.header)}
      <main id="main">{render(page.sections, true)}</main>
      {render(page.globals.footer)}
    </div>
  )
}
