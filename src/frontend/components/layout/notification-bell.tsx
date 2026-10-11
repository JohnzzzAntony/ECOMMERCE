'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, Mail } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { cn } from '@/frontend/lib/utils'

export function NotificationBell() {
  const { notifications, markNotificationRead, clearNotifications, unreadCount } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = unreadCount()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative flex flex-col items-center rounded-lg px-2 py-1.5 text-brand-ink transition-colors hover:bg-secondary"
      >
        <div className="relative">
          <Bell size={20} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        <span className="hidden text-[10px] font-medium sm:block">Alerts</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-brand-teal" />
              <span className="text-sm font-semibold text-brand-ink">Notifications</span>
              {count > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{count} new</span>
              )}
            </div>
            {notifications.length > 0 && (
              <button onClick={clearNotifications} className="text-xs text-muted-foreground hover:text-brand-teal">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail size={32} className="text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Order updates will appear here</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border p-3 text-left last:border-0 transition-colors hover:bg-secondary',
                    !n.read && 'bg-brand-teal/5'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    n.read ? 'bg-secondary text-muted-foreground' : 'bg-brand-teal/10 text-brand-teal'
                  )}>
                    {n.read ? <Check size={14} /> : <Mail size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-brand-ink truncate">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-teal" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{formatTime(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
