'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/frontend/lib/utils'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={cn(
        'fixed bottom-20 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full',
        'bg-brand-teal text-white shadow-lg shadow-brand-teal/30 transition-all',
        'hover:bg-brand-teal-dark hover:scale-110 animate-fade-in-up'
      )}
    >
      <ArrowUp size={20} />
    </button>
  )
}
