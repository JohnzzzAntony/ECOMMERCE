// Video URLs on sections: embeds are recognised and the hero plays a background video.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateSection, type SectionInstance } from '../src/shared/sections/registry'
import Hero from '../src/frontend/components/sections/hero'
import { embedFor } from '../src/frontend/components/sections/video'

test('local uploads and embeds are recognised', () => {
  expect(embedFor('/api/design/storage/tenants/legacy/videos/abc.mp4')).toEqual({ kind: 'video', src: '/api/design/storage/tenants/legacy/videos/abc.mp4' })
  expect(embedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.kind).toBe('iframe')
  expect(embedFor('/etc/passwd')).toBeNull()
})

test('hero background video', () => {
  const hero: SectionInstance = { id: 'h1', type: 'hero', figmaNodeId: null, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1, settings: { title: 'Jouri', video: 'https://example.com/hero.mp4', layout: 'background', image: null } }
  const ok = validateSection(hero)
  expect(ok.ok).toBe(true)
  const html = renderToStaticMarkup(Hero({ section: ok.ok ? ok.section : hero, data: undefined, page: {} as never, priority: true }) as never)
  expect(html).toContain('src="https://example.com/hero.mp4"')
})
