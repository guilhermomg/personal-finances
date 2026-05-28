'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertBudget } from '../lib/actions'
import { formatCurrency, formatPct, barColor } from '../lib/format'
import { ProgressBar } from './ProgressBar'

type EditTarget = {
  billingPeriodId: number
  category: string | null
}

type Props = {
  label: string
  spent: number
  ceiling: number
  projected?: number
  deduction?: { amount: number; label: string }
  editTarget?: EditTarget
}

export function SpendingCard({ label, spent, ceiling, projected, deduction, editTarget }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [, startTransition] = useTransition()

  const hasBudget = ceiling > 0
  const ratio = hasBudget ? spent / ceiling : 0
  const projectedRatio = projected !== undefined && hasBudget ? projected / ceiling : undefined
  const color = barColor(ratio)
  const pctColor = ratio > 0.9 ? 'var(--danger)' : ratio > 0.65 ? 'var(--warn)' : 'var(--accent)'

  function openEdit() {
    setDraft(hasBudget ? String(ceiling) : '')
    setEditing(true)
  }

  function saveEdit() {
    const amount = parseFloat(draft)
    if (!isNaN(amount) && amount > 0 && editTarget) {
      startTransition(async () => {
        await upsertBudget(editTarget.billingPeriodId, editTarget.category, amount)
        setEditing(false)
        router.refresh()
      })
    } else {
      setEditing(false)
    }
  }

  const ceilingNode = editTarget ? (
    editing ? (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={saveEdit}
        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: '80px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text)',
          fontSize: '11px',
          padding: '2px 6px',
          outline: 'none',
        }}
      />
    ) : (
      <span
        onClick={openEdit}
        title="Click to set budget"
        style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
      >
        {hasBudget ? formatCurrency(ceiling) : 'set budget'}
      </span>
    )
  ) : (
    <span>{formatCurrency(ceiling)}</span>
  )

  return (
    <div className="card">
      <div className="card-label">{label} · Ceiling {ceilingNode}</div>
      <div className="big-num">{formatCurrency(spent)}</div>
      {hasBudget ? (
        <>
          <div className="sub-num">
            <span style={{ color: pctColor }}>{formatPct(spent, ceiling)}</span> used ·{' '}
            {formatCurrency(ceiling - spent)} remaining
          </div>
          {deduction !== undefined && (
            <div className="sub-num" style={{ marginTop: 2 }}>
              {formatCurrency(ceiling - spent - deduction.amount)}{' '}
              <span style={{ color: 'var(--muted)' }}>{deduction.label}</span>
            </div>
          )}
          {projected !== undefined && (
            <div className="projected">→ projected {formatCurrency(projected)}</div>
          )}
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>$0</span>
              <span>{formatCurrency(ceiling)}</span>
            </div>
            <ProgressBar ratio={ratio} color={color} projectedRatio={projectedRatio} />
          </div>
        </>
      ) : (
        <div className="sub-num" style={{ color: 'var(--muted)' }}>No budget set for this period</div>
      )}
    </div>
  )
}
