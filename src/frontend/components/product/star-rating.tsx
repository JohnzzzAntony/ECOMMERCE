'use client'

import { Star } from 'lucide-react'
import { cn } from '@/frontend/lib/utils'

interface StarRatingProps {
  rating: number
  size?: number
  className?: string
  showNumber?: boolean
  count?: number
}

export function StarRating({ rating, size = 14, className, showNumber, count }: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star
          const half = rating >= star - 0.5 && rating < star
          return (
            <Star
              key={star}
              size={size}
              className={cn(
                filled ? 'fill-amber-400 text-amber-400' : half ? 'fill-amber-400/50 text-amber-400' : 'fill-gray-200 text-gray-200'
              )}
            />
          )
        })}
      </div>
      {showNumber && (
        <span className="text-xs text-muted-foreground">
          {rating.toFixed(1)}
          {count !== undefined && ` (${count})`}
        </span>
      )}
    </div>
  )
}
