'use client'

import { X, GitCompare, Trash2 } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'

import { toast } from 'sonner'

export function CompareBar() {
  const { compareList, toggleCompare, clearCompare, navigate, compareCount } = useStore()

  if (compareList.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <GitCompare size={18} className="text-brand-teal" />
          <span className="hidden sm:inline">Compare ({compareCount()}/4)</span>
        </div>
        <div className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
          {compareList.map((id) => {
            const item = useStore.getState().cart.find((c) => c.productId === id)?.product
            // Fallback: fetch from a simple lookup isn't available here, so show a generic chip
            return (
              <div key={id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs">
                <span className="max-w-24 truncate">{item?.name || `Product ${id.slice(-4)}`}</span>
                <button onClick={() => { toggleCompare(id) }} className="text-muted-foreground hover:text-red-500" aria-label="Remove from compare">
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearCompare(); toast.success('Compare list cleared') }}
            className="hidden items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary sm:flex"
          >
            <Trash2 size={14} /> Clear
          </button>
          <button
            onClick={() => navigate('compare')}
            disabled={compareList.length < 2}
            className="rounded-lg bg-brand-teal px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:bg-muted"
          >
            Compare Now
          </button>
        </div>
      </div>
    </div>
  )
}
