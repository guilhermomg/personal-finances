import { formatCurrency, formatPct, barColor } from '../lib/format'
import { ProgressBar } from './ProgressBar'

type Rating = { label: string; color: string }

function getRating(pct: number): Rating {
  if (pct < 0.10) return { label: 'Excellent', color: 'var(--accent2)' }
  if (pct < 0.30) return { label: 'Good',      color: 'var(--accent)' }
  if (pct < 0.50) return { label: 'Fair',       color: 'var(--warn)' }
  return               { label: 'Poor',      color: 'var(--danger)' }
}

type Props = {
  totalCreditLimit: number
  totalCreditProjected: number
}

export function CreditUsageCard({ totalCreditLimit, totalCreditProjected }: Props) {
  const ratio = totalCreditLimit > 0 ? totalCreditProjected / totalCreditLimit : 0
  const rating = getRating(ratio)
  const color = barColor(ratio)
  const available = totalCreditLimit - totalCreditProjected

  return (
    <div className="card">
      <div className="section-title">
        <span className="dot" style={{ background: 'var(--accent)' }} />
        Credit Usage
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
        <div className="big-num">{formatPct(totalCreditProjected, totalCreditLimit)}</div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: rating.color,
            background: `color-mix(in srgb, ${rating.color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${rating.color} 30%, transparent)`,
            borderRadius: '99px',
            padding: '2px 10px',
          }}
        >
          {rating.label}
        </span>
      </div>

      <div className="sub-num" style={{ marginTop: '4px' }}>
        {formatCurrency(totalCreditProjected)} of {formatCurrency(totalCreditLimit)} limit ·{' '}
        <span style={{ color: 'var(--accent2)' }}>{formatCurrency(available)} available</span>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ProgressBar ratio={Math.min(ratio, 1)} color={color} />
      </div>

      {/* Threshold markers */}
      <div style={{ position: 'relative', marginTop: '8px', height: '16px' }}>
        {[
          { pct: 0.10, label: '10%' },
          { pct: 0.30, label: '30%' },
          { pct: 0.50, label: '50%' },
        ].map(({ pct, label }) => (
          <span
            key={label}
            style={{
              position: 'absolute',
              left: `${pct * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: '9px',
              color: 'var(--muted)',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Rating legend */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Excellent', range: '< 10%', color: 'var(--accent2)' },
          { label: 'Good',      range: '10–30%', color: 'var(--accent)' },
          { label: 'Fair',      range: '30–50%', color: 'var(--warn)' },
          { label: 'Poor',      range: '> 50%',  color: 'var(--danger)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: item.label === rating.label ? 'var(--text)' : 'var(--muted)' }}>
              {item.label} <span style={{ color: 'var(--muted)' }}>{item.range}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
