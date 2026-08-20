'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCreditLimit } from '../lib/actions'
import { formatCurrency, formatPct, barColor } from '../lib/format'
import type { CardData } from '../types/finance'
import { ProgressBar, type BarColor } from './ProgressBar'

export function CardSummary({ name, spent, projected, closeDate, month, accountId, cycleId, totalPaid, creditLimit, accountType, cycleStartDate, cycleEndDate }: CardData & { month?: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [, startTransition] = useTransition()

  // Credit card: bars are relative to the credit limit.
  // Bank account: single bar relative to projected spend.
  const hasLimit = accountType === 'credit_card' && creditLimit != null && creditLimit > 0
  const spentRatio  = hasLimit ? spent     / creditLimit! : (projected > 0 ? spent / projected : 0)
  const projRatio   = hasLimit ? projected / creditLimit! : 1
  const utilColor   = barColor(hasLimit ? projRatio : spentRatio) as BarColor
  const available   = creditLimit != null ? creditLimit - projected : null

  const params = new URLSearchParams({ method: name })
  if (cycleStartDate) params.set('from', cycleStartDate)
  if (cycleEndDate) params.set('to', cycleEndDate)
  if (month) params.set('month', month)

  function openEdit() {
    setDraft(creditLimit != null ? String(creditLimit) : '')
    setEditing(true)
  }

  function saveEdit() {
    const amount = draft.trim() === '' ? null : parseFloat(draft)
    if (amount !== null && isNaN(amount)) { setEditing(false); return }
    startTransition(async () => {
      await updateCreditLimit(accountId, amount)
      setEditing(false)
      router.refresh()
    })
  }

  const limitNode = editing ? (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={saveEdit}
      onClick={e => e.stopPropagation()}
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
      onClick={e => { e.preventDefault(); e.stopPropagation(); openEdit() }}
      title="Click to set credit limit"
      style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
    >
      {creditLimit != null ? formatCurrency(creditLimit) : 'set limit'}
    </span>
  )

  return (
    <Link href={`/finances/transactions?${params}`} className="card-link">
      <div className="card">
        <div className="card-label">{name} · Closes {closeDate}{accountType === 'credit_card' ? <> · Limit {limitNode}</> : null}</div>
        <div className="big-num">{formatCurrency(spent)}</div>

        {/* Spending bar */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
            {hasLimit && projected > spent ? (
              <span>
                {formatCurrency(spent)} spent
                <span style={{ color: 'var(--accent)', opacity: 0.7 }}> · {formatCurrency(projected)} projected</span>
              </span>
            ) : (
              <span>$0</span>
            )}
            <span>{hasLimit ? formatCurrency(creditLimit!) : formatCurrency(projected)}</span>
          </div>
          <ProgressBar ratio={spentRatio} color="accent" projectedRatio={hasLimit ? projRatio : undefined} />
        </div>

        {/* Credit utilization */}
        {hasLimit && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span style={{ color: utilColor === 'green' ? 'var(--accent2)' : utilColor === 'yellow' ? 'var(--warn)' : 'var(--danger)' }}>
                {formatPct(spent, creditLimit!)} utilized
                {projected > spent && <span style={{ opacity: 0.6 }}> · {formatPct(projected, creditLimit!)} projected</span>}
              </span>
              <span>{formatCurrency(available!)} available</span>
            </div>
            <ProgressBar ratio={spentRatio} color={utilColor} projectedRatio={projRatio} />
          </div>
        )}

        {/* Payments */}
        {accountType === 'credit_card' && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
            <span style={{ color: totalPaid > 0 ? 'var(--accent2)' : 'var(--muted)' }}>
              Paid: {formatCurrency(totalPaid)}
            </span>
            <span>
              Outstanding: {formatCurrency(Math.max(0, projected - totalPaid))}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
