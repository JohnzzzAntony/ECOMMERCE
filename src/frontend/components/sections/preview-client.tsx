'use client'
// Draft preview inside the admin editor's iframe. The editor posts section changes (postMessage, same origin);
// the preview re-renders at once and refreshes catalog data for data-bound sections in the background.
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
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

export type PreviewMessage = { type: 'nexecoms:preview'; sections: SectionInstance[]; selectedId?: string | null }

export function PreviewClient({ initial, dataUrl }: { initial: RenderedPage; dataUrl: string }) {
  const [page, setPage] = useState(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const msg = e.data as PreviewMessage
      if (msg?.type !== 'nexecoms:preview' || !Array.isArray(msg.sections)) return
      setSelected(msg.selectedId ?? null)
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
    window.parent?.postMessage({ type: 'nexecoms:preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [dataUrl])

  useEffect(() => {
    if (selected) document.querySelector(`[data-sid="${CSS.escape(selected)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selected])

  const { tokens, fonts } = page
  const css = useMemo(() => baseCss({ tokens, fonts }), [tokens, fonts])
  const render = (list: SectionInstance[], first = false) => list.map((s, i) => {
    const C = LAZY[s.type]
    return (
      <div key={s.id} className={selected === s.id ? 'outline outline-2 -outline-offset-2 outline-sky-500' : undefined}>
        <SectionBoundary name={s.type}><Suspense fallback={<div className="h-24 animate-pulse bg-black/5" />}><C section={s} data={page.data[s.id]} page={page} priority={first && i === 0} /></Suspense></SectionBoundary>
      </div>
    )
  })
  return (
    <div className="figma-store min-h-screen">
      <style>{css}</style>
      {render(page.globals.announcement)}
      {render(page.globals.header)}
      <main id="main">{render(page.sections, true)}</main>
      {render(page.globals.footer)}
    </div>
  )
}
