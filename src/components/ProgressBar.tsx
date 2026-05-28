'use client'

import { useEffect, useState } from 'react'

export type BarColor = 'green' | 'yellow' | 'red' | 'accent'

const colorMap: Record<BarColor, string> = {
  green:  'var(--accent2)',
  yellow: 'var(--warn)',
  red:    'var(--danger)',
  accent: 'var(--accent)',
}

type Props = { ratio: number; color: BarColor; projectedRatio?: number }

export function ProgressBar({ ratio, color, projectedRatio }: Props) {
  const [width, setWidth] = useState(0)
  const [projWidth, setProjWidth] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => {
      setWidth(Math.min(ratio * 100, 100))
      if (projectedRatio !== undefined) setProjWidth(Math.min(projectedRatio * 100, 100))
    }, 50)
    return () => clearTimeout(id)
  }, [ratio, projectedRatio])

  return (
    <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '99px', position: 'relative' }}>
      {projectedRatio !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 0, top: 0,
            width: `${projWidth}%`,
            height: '100%',
            borderRadius: '99px',
            background: colorMap[color],
            opacity: 0.3,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0,
          width: `${width}%`,
          height: '100%',
          borderRadius: '99px',
          background: colorMap[color],
          transition: 'width 1s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </div>
  )
}
