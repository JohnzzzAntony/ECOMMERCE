'use client'
// Storefront access to the active theme: settings with defaults, menu links, page links.
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useStore } from '@/frontend/store/use-store'
import { CORE_SETTINGS, DEFAULT_MENUS, DEFAULT_SECTIONS, resolveLink, resolveSettings, type StorefrontTheme, type ThemeValue } from '@/shared/theme'

const CORE_DEFAULTS = resolveSettings(CORE_SETTINGS, {})

/**
 * Provided by StorefrontApp: the server-rendered theme, replaced by the store copy after an admin edit.
 * (Context rather than the Zustand store so server rendering never shares theme state between requests.)
 */
export const ThemeContext = createContext<StorefrontTheme | null>(null)

/** Active theme with safe fallbacks. */
export function useTheme() {
  const theme = useContext(ThemeContext)
  return useMemo(() => ({
    settings: theme?.settings ?? CORE_DEFAULTS,
    sections: theme?.sections ?? DEFAULT_SECTIONS,
    menus: theme?.menus ?? DEFAULT_MENUS,
    kind: theme?.kind ?? 'native',
  }), [theme])
}

export const settingText = (v: ThemeValue | undefined) => (v === undefined || v === null ? '' : String(v))

/** Follow a menu/section link (see resolveLink). Returns false if the link points nowhere. */
export function useFollowLink() {
  const navigate = useStore((s) => s.navigate)
  return useCallback((link: string) => {
    const target = resolveLink(link)
    if (target.kind === 'view') navigate(target.view, target.params)
    else if (target.kind === 'href') {
      if (target.external) window.open(target.href, '_blank', 'noopener,noreferrer')
      else followHref(target.href, navigate)
    } else return false
    return true
  }, [navigate])
}

/**
 * In-app handling for links inside custom HTML. Imported template pages link to each other as
 * /?page=<slug>; '/' is the homepage. Returns true when the SPA handled the navigation.
 */
export function followHref(href: string, navigate = useStore.getState().navigate): boolean {
  let url: URL
  try { url = new URL(href, window.location.origin) } catch { return false }
  if (url.origin !== window.location.origin) return false
  const page = url.searchParams.get('page')
  if (page) { navigate('page', { slug: page }); return true }
  if (url.pathname === '/' && !url.search) { navigate('home'); return true }
  window.location.href = url.toString()
  return true
}
