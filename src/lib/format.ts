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
