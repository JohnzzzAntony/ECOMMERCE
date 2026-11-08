'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Scroll-snap product rail with keyboard-accessible controls and native touch scrolling. */
export function ProductRail({ children, label }: { children: ReactNode; label: string }) {
  const rail = useRef<HTMLUListElement>(null)
  const scroll = (direction: -1 | 1) => {
    const first = rail.current?.querySelector('li')
    rail.current?.scrollBy({ left: direction * ((first?.getBoundingClientRect().width ?? 280) + 24), behavior: 'smooth' })
  }
  return (
    <div className="relative">
      <div className="mb-5 flex justify-end gap-2">
        <button type="button" onClick={() => scroll(-1)} aria-label={`Previous ${label}`} className="inline-flex size-11 items-center justify-center rounded-full border border-current/15 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label={`Next ${label}`} className="inline-flex size-11 items-center justify-center rounded-full border border-current/15 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
      <ul ref={rail} aria-label={label} className="flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:thin] [&>li]:w-[78%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[calc((100%-1.25rem)/2)] lg:[&>li]:w-[calc((100%-2.5rem)/3)] xl:[&>li]:w-[calc((100%-3.75rem)/4)]">
        {children}
      </ul>
    </div>
  )
}
