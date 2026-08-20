import type { Account } from '../../types/finance'

export function getCycleDay(pm: string, configs: Account[]): number | undefined {
  return configs.find(c => c.payment_method === pm && c.account_type === 'credit_card')?.cycle_start_day
}

export function isCreditCard(pm: string, configs: Account[]): boolean {
  return configs.some(c => c.payment_method === pm && c.account_type === 'credit_card')
}

export function getBillingCycleOptions(
  dateStr: string,
  pm: string,
  configs: Account[]
): { label: string; value: string }[] {
  const closeDay = getCycleDay(pm, configs)
  if (closeDay === undefined) return []

  const d = new Date(dateStr + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')

  const aDate = `${year}-${pad(month + 1)}-${pad(closeDay)}`
  const aLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const nextYear = month === 11 ? year + 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const bDate = `${nextYear}-${pad(nextMonth + 1)}-${pad(closeDay)}`
  const bLabel = new Date(nextYear, nextMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return [
    { label: aLabel, value: aDate },
    { label: bLabel, value: bDate },
  ]
}

export function getDefaultStatementDate(dateStr: string, pm: string, configs: Account[]): string {
  const closeDay = getCycleDay(pm, configs)
  if (closeDay === undefined) return ''

  const d = new Date(dateStr + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const day = d.getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  if (day >= closeDay) {
    const nextYear = month === 11 ? year + 1 : year
    const nextMonth = month === 11 ? 0 : month + 1
    return `${nextYear}-${pad(nextMonth + 1)}-${pad(closeDay)}`
  }
  return `${year}-${pad(month + 1)}-${pad(closeDay)}`
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '16px',
  padding: '8px 12px',
  outline: 'none',
  colorScheme: 'dark',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '6px',
}
