import type { TransactionType } from '../types/finance'

export function formatCurrency(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatPct(amount: number, total: number): string {
  if (total === 0) return '0.0%'
  return ((amount / total) * 100).toFixed(1) + '%'
}

export function barColor(ratio: number): 'green' | 'yellow' | 'red' {
  if (ratio < 0.65) return 'green'
  if (ratio < 0.9) return 'yellow'
  return 'red'
}

// ── transaction types ─────────────────────────────────────────────────────────
// Display-side helpers, kept here (rather than in lib/finance.ts) so client
// components can import them without pulling in the Supabase admin client.

// Which way a transaction moves money in its account, for display purposes.
// Expenses and transfers out are money leaving; refunds, cashback and income
// are money arriving. Note this is NOT the same question as "is it spending?" —
// a transfer leaves the account without being spend. See isSpend() in
// lib/finance.ts for the budget/category side.
export function txDisplaySign(type: TransactionType | undefined): 1 | -1 {
  return type === undefined || type === 'expense' || type === 'transfer' ? 1 : -1
}

// Badge text for a transaction row, or null for a plain expense (no badge).
export function txTypeLabel(type: TransactionType | undefined): string | null {
  switch (type) {
    case 'cashback': return 'Cashback'
    case 'refund':   return 'Refund'
    case 'income':   return 'Income'
    case 'transfer': return 'Transfer'
    default:         return null
  }
}

// Money arriving reads green; a transfer out is neither spend nor income, so it
// gets a neutral badge rather than the credit-green treatment.
export function txIsCredit(type: TransactionType | undefined): boolean {
  return txDisplaySign(type) === -1
}
