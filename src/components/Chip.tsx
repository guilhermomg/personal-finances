import type { ChipVariant } from '../types/finance'

const STYLES: Record<ChipVariant, React.CSSProperties> = {
  amex:    { background: 'rgba(96,165,250,.15)',  color: '#60a5fa', border: '1px solid rgba(96,165,250,.3)'  },
  td:      { background: 'rgba(74,222,128,.15)',  color: '#4ade80', border: '1px solid rgba(74,222,128,.3)'  },
  ws:      { background: 'rgba(156,163,175,.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,.3)' },
  'ws-visa': { background: 'rgba(156,163,175,.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,.3)' },
  paypal:  { background: 'rgba(14,165,233,.15)',  color: '#0ea5e9', border: '1px solid rgba(14,165,233,.3)'  },
  klarna:  { background: 'rgba(236,72,153,.15)',  color: '#ec4899', border: '1px solid rgba(236,72,153,.3)'  },
  affirm:  { background: 'rgba(167,139,250,.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,.3)' },
}

const LABELS: Record<ChipVariant, string> = {
  amex: 'Amex', td: 'TD', ws: 'WS', 'ws-visa': 'WS Visa',
  paypal: 'PayPal', klarna: 'Klarna', affirm: 'Affirm',
}

type Props = { variant: ChipVariant; label?: string }

export function Chip({ variant, label }: Props) {
  return (
    <span
      style={{
        ...STYLES[variant],
        display: 'inline-block',
        fontSize: '10px',
        padding: '2px 8px',
        borderRadius: '99px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? LABELS[variant]}
    </span>
  )
}
