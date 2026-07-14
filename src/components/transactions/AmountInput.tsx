'use client'

import { inputStyle } from './transaction-utils'

// Formats a numeric value into the 2-decimal string an AmountInput displays.
// Falls back to "0.00" for empty/invalid values.
export function toAmountString(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

type Props = {
  value: string
  onValueChange: (value: string) => void
  style?: React.CSSProperties
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  placeholder?: string
}

// Implied-decimal currency entry: typed digits accumulate as cents and shift
// two places. "1"→0.01, "12"→0.12, "125"→1.25, "1250"→12.50. Backspace drops
// the last digit. Always renders a fixed 2-decimal string.
export function AmountInput({ value, onValueChange, style, onKeyDown, placeholder }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      style={style ?? inputStyle}
      value={value}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onChange={e => {
        const cents = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
        onValueChange((cents / 100).toFixed(2))
      }}
    />
  )
}
