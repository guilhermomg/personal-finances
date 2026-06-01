import type { PaymentStyleMap } from '../types/finance'

// Resolves <Chip> props for a payment method / provider name from the DB-driven
// style map. Falls back to the raw name + default color when a name is unmapped.
export function chipProps(styles: PaymentStyleMap, name: string | null | undefined) {
  if (!name) return { label: '', colorMain: null, colorSecondary: null }
  const s = styles[name]
  return {
    label: s?.label ?? name,
    colorMain: s?.colorMain ?? null,
    colorSecondary: s?.colorSecondary ?? null,
  }
}
