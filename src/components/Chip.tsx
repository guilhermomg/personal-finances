// Brand-free palette. Colors are referenced by generic token from the DB
// (finances.payment_method_styles) and resolved to hex here, so the code never
// names a specific bank, card, or provider.
const PALETTE: Record<string, string> = {
  blue:   '#60a5fa',
  green:  '#4ade80',
  slate:  '#9ca3af',
  sky:    '#0ea5e9',
  pink:   '#ec4899',
  violet: '#a78bfa',
  amber:  '#f5b85a',
  red:    '#f55a6e',
  teal:   '#2dd4bf',
}
const FALLBACK = '#9ca3af'

function hex(token: string | null | undefined): string {
  return (token && PALETTE[token]) || FALLBACK
}

type Props = {
  label: string
  colorMain?: string | null
  colorSecondary?: string | null
}

export function Chip({ label, colorMain, colorSecondary }: Props) {
  const main = hex(colorMain)
  const bg = colorSecondary ? hex(colorSecondary) : main
  return (
    <span
      style={{
        background: `color-mix(in srgb, ${bg} 15%, transparent)`,
        color: main,
        border: `1px solid color-mix(in srgb, ${main} 30%, transparent)`,
        display: 'inline-block',
        fontSize: '10px',
        padding: '2px 8px',
        borderRadius: '99px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
