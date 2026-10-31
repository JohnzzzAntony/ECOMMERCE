'use client'
// Custom code section: admin-written or AI-generated HTML/CSS/JS. It runs in the sandboxed theme frame (own opaque
// origin, no access to the store page, cookies or storage) and grows to fit its content.
import { IsolatedFrame } from '@/frontend/components/theme/html-content'
import { settingsOf, type SectionProps } from './shared'

export default function CustomCode({ section }: SectionProps) {
  const s = settingsOf<{ label: string; html: string; css: string; js: string }>(section)
  // "</script" inside the code would end the script element early.
  const script = s.js.trim() ? `<script>${s.js.replace(/<\/(script)/gi, '<\/$1')}</script>` : ''
  return <div data-sid={section.id}><IsolatedFrame html={s.html + script} css={s.css} title={s.label || 'Custom section'} /></div>
}
