import type { ChipVariant } from '../types/finance'

export function chipVariantFromPm(pm: string): ChipVariant {
  const p = pm.toLowerCase()
  if (p.includes('amex')) return 'amex'
  if (p.includes('wealthsimple') && p.includes('visa')) return 'ws-visa'
  if (p.includes('td') || p.includes('visa')) return 'td'
  return 'ws'
}

export function chipVariantFromProvider(provider: string): ChipVariant {
  const p = provider.toLowerCase()
  if (p.includes('paypal')) return 'paypal'
  if (p.includes('klarna')) return 'klarna'
  if (p.includes('affirm')) return 'affirm'
  return 'ws'
}
