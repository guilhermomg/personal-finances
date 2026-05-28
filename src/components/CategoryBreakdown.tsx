'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertBudget } from '../lib/actions'
import { formatCurrency, formatPct } from '../lib/format'
import type { CategoryData } from '../types/finance'

type Props = {
  categories: CategoryData[]
  totalCeiling: number
  categoryBudgets: Record<string, number>
  billingPeriodId: number
}

export function CategoryBreakdown({ categories, totalCeiling, categoryBudgets, billingPeriodId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const max = Math.max(...categories.map(c => c.amount), 1)

  function startEdit(name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(String(categoryBudgets[name] ?? ''))
    setEditingCategory(name)
  }

  function saveBudget(name: string) {
    const amount = parseFloat(draft)
    if (!isNaN(amount) && amount > 0) {
      startTransition(async () => {
        await upsertBudget(billingPeriodId, name, amount)
        setEditingCategory(null)
        router.refresh()
      })
    } else {
      setEditingCategory(null)
    }
  }

  return (
    <div className="card">
      <div className="section-title">
        <span className="dot" style={{ background: 'var(--amex)' }} />
        Spending by Category
      </div>
      {categories.map(({ name, amount }) => {
        const budget = categoryBudgets[name]
        const isEditing = editingCategory === name

        return (
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

            {/* Budget column — stops row click from navigating */}
            <div
              style={{ width: '90px', textAlign: 'right', fontSize: '11px', color: 'var(--muted)' }}
              onClick={e => e.stopPropagation()}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => saveBudget(name)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveBudget(name)
                    if (e.key === 'Escape') setEditingCategory(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '80px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    fontSize: '11px',
                    padding: '2px 6px',
                    outline: 'none',
                    textAlign: 'right',
                  }}
                />
              ) : budget ? (
                <span
                  title="Click to edit budget"
                  style={{ cursor: 'pointer' }}
                  onClick={e => startEdit(name, e)}
                >
                  / {formatCurrency(budget)}
                </span>
              ) : (
                <span
                  title="Set budget"
                  style={{ opacity: 0.35, cursor: 'pointer' }}
                  onClick={e => startEdit(name, e)}
                >
                  set budget
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
