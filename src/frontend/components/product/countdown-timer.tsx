'use client'

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  /** Target date; defaults to end of current day + 2 days (a 2-day countdown that resets) */
  targetDate?: Date
  className?: string
  variant?: 'light' | 'dark'
}

function getDefaultTarget() {
  // Persistent 3-day rolling countdown: aligns to next midnight boundary cycle
  const stored = typeof window !== 'undefined' ? localStorage.getItem('jkr-offer-deadline') : null
  if (stored) {
    const d = new Date(parseInt(stored, 10))
    if (d.getTime() > Date.now()) return d
  }
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  if (typeof window !== 'undefined') localStorage.setItem('jkr-offer-deadline', String(d.getTime()))
  return d
}

export function CountdownTimer({ targetDate, className, variant = 'dark' }: CountdownTimerProps) {
  // Resolve the target date once on mount via lazy initializer (no setState-in-effect)
  const [target, setTarget] = useState<Date>(() => targetDate ?? getDefaultTarget())
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) {
        // Reset for another 3 days
        const newTarget = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        setTarget(newTarget)
        if (typeof window !== 'undefined') localStorage.setItem('jkr-offer-deadline', String(newTarget.getTime()))
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)
      setRemaining({ days, hours, minutes, seconds })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  const units = [
    { label: 'Days', value: remaining.days },
    { label: 'Hours', value: remaining.hours },
    { label: 'Mins', value: remaining.minutes },
    { label: 'Secs', value: remaining.seconds },
  ]

  const isLight = variant === 'light'

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          <div className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 min-w-[52px] ${isLight ? 'bg-white text-brand-teal-dark' : 'bg-brand-ink text-white'}`}>
            <span className="text-lg font-bold tabular-nums leading-none sm:text-xl">
              {String(u.value).padStart(2, '0')}
            </span>
            <span className={`mt-0.5 text-[9px] font-medium uppercase tracking-wider ${isLight ? 'text-muted-foreground' : 'text-white/60'}`}>
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className={`text-lg font-bold ${isLight ? 'text-brand-teal-dark' : 'text-white/50'}`}>:</span>
          )}
        </div>
      ))}
    </div>
  )
}
