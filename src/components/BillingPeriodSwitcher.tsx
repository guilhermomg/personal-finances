'use client'

import { useRouter } from 'next/navigation'
import type { BillingPeriod } from '../types/finance'

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
  padding: '4px 10px',
  transition: 'color 0.15s',
}

function offsetMonth(startMonth: string, delta: number): string {
  const [year, month] = startMonth.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function BillingPeriodSwitcher({ currentPeriod, basePath = '/finances' }: {
  currentPeriod: BillingPeriod
  basePath?: string
}) {
  const router = useRouter()

  function navigate(delta: number) {
    const month = offsetMonth(currentPeriod.start_month, delta)
    router.push(`${basePath}?month=${month}`)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button style={btnStyle} onClick={() => navigate(-1)}>←</button>
      <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '170px', textAlign: 'center' }}>
        {currentPeriod.name}
        {currentPeriod.status === 'open' && (
          <span style={{ color: 'var(--accent)', marginLeft: '6px', fontSize: '10px' }}>●</span>
        )}
      </span>
      <button style={btnStyle} onClick={() => navigate(1)}>→</button>
    </div>
  )
}
