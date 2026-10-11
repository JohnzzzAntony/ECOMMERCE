'use client'
// Storefront side of the theme editor. When the store runs inside the admin editor's preview
// frame (/?theme-editor=1, same origin), the editor streams the unsaved theme here and every
// click on a section selects it in the editor instead of following links.
import { useEffect, useState } from 'react'
import type { StorefrontTheme } from '@/shared/theme'

export type EditorDraft = Pick<StorefrontTheme, 'schema' | 'settings' | 'sections' | 'css' | 'kind'>

export type EditorMessage =
  | { type: 'nx-editor-ready' }
  | { type: 'nx-editor-select'; id: string | null }
  | { type: 'nx-editor-theme'; theme: EditorDraft }

export const EDITOR_PARAM = 'theme-editor'

/** Returns the editor's draft theme while in the preview frame, else null. */
export function useEditorDraft(): EditorDraft | null {
  const [draft, setDraft] = useState<EditorDraft | null>(null)

  useEffect(() => {
    if (window.parent === window || !new URLSearchParams(window.location.search).has(EDITOR_PARAM)) return
    const parent = window.parent
    const send = (msg: EditorMessage) => parent.postMessage(msg, window.location.origin)
    const root = document.documentElement
    root.classList.add('theme-editing')

    const select = (id: string | null, scroll: boolean) => {
      document.querySelectorAll('[data-editor-selected]').forEach((el) => el.removeAttribute('data-editor-selected'))
      if (!id) return
      const el = document.querySelector(`[data-section-id="${CSS.escape(id)}"]`)
      if (!el) return
      el.setAttribute('data-editor-selected', '')
      if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    let selected: string | null = null

    const onMessage = (e: MessageEvent<EditorMessage>) => {
      if (e.origin !== window.location.origin || e.source !== parent) return
      if (e.data?.type === 'nx-editor-theme') setDraft(e.data.theme)
      if (e.data?.type === 'nx-editor-select') { selected = e.data.id; select(selected, true) }
    }
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-section-id]')
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      selected = el.getAttribute('data-section-id')
      select(selected, false)
      send({ type: 'nx-editor-select', id: selected })
    }
    // Sections re-render as settings change; keep the selection outline on the new element.
    const keep = new MutationObserver(() => {
      if (selected && !document.querySelector('[data-editor-selected]')) select(selected, false)
    })
    keep.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('message', onMessage)
    document.addEventListener('click', onClick, true)
    send({ type: 'nx-editor-ready' })
    return () => {
      keep.disconnect()
      root.classList.remove('theme-editing')
      window.removeEventListener('message', onMessage)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return draft
}
