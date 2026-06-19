'use client'

import { useRouter } from 'next/navigation'
import { formatCurrency, formatPct } from '../lib/format'
import type { CategoryData } from '../types/finance'

type Props = {
  categories: CategoryData[]
  totalCeiling: number
}

export function CategoryBreakdown({ categories, totalCeiling }: Props) {
  const router = useRouter()

  const max = Math.max(...categories.map(c => c.amount), 1)

  return (
    <div className="card">
      <div className="section-title">
        <span className="dot" style={{ background: 'var(--accent)' }} />
        Spending by Category
      </div>
      {categories.map(({ name, amount }) => (
        <div
          key={name}
          className="cat-row"
          style={{ cursor: 'pointer' }}
          onClick={() => router.push(`/finances/transactions?category=${encodeURIComponent(name)}`)}
        >
          <span className="cat-name">{name}</span>
          <div className="cat-bar-wrap">
            <div className="cat-bar-fill" style={{ width: `${(amount / max) * 100}%` }} />
          </div>
          <span className="cat-pct">{formatPct(amount, totalCeiling)}</span>
          <span className="cat-amt">{formatCurrency(amount)}</span>
        </div>
      ))}
    </div>
  )
}
