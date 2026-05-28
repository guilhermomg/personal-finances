import { formatCurrency, formatPct } from '../lib/format'
import { Chip } from './Chip'
import { chipVariantFromPm, chipVariantFromProvider } from './chipUtils'
import type { TransactionRow } from '../types/finance'

const creditBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '9px',
  padding: '1px 6px',
  borderRadius: '99px',
  fontWeight: 500,
  letterSpacing: '0.5px',
  marginLeft: '6px',
  background: 'rgba(52,199,89,0.15)',
  color: '#34c759',
  border: '1px solid rgba(52,199,89,0.3)',
  verticalAlign: 'middle',
}

function txDisplayAmount(row: TransactionRow) {
  const type = row.transaction_type ?? 'expense'
  return type === 'expense' ? row.amount : -row.amount
}

function CreditBadge({ type }: { type?: string }) {
  if (!type || type === 'expense') return null
  return <span style={creditBadgeStyle}>{type === 'cashback' ? 'Cashback' : 'Refund'}</span>
}

type Props = {
  title: string
  dotColor: string
  rows: TransactionRow[]
  total: number
  totalSpent: number
  totalColor?: string
  onRowClick?: (row: TransactionRow) => void
}

export function TransactionTable({ title, dotColor, rows, total, totalSpent, totalColor, onRowClick }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="card">
      <div className="section-title">
        <span className="dot" style={{ background: dotColor }} />
        {title}
      </div>

      {/* ── Desktop table ── */}
      <table className="tx-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Day</th>
            <th style={{ textAlign: 'right', paddingLeft: '12px' }}>% Total</th>
            <th style={{ textAlign: 'right', paddingLeft: '12px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ ...(row.date > todayStr ? { opacity: 0.35 } : {}), ...(onRowClick ? { cursor: 'pointer' } : {}) }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <td>
                <Chip variant={chipVariantFromPm(row.payment_method)} />
                {row.payment_provider && (
                  <span style={{ marginLeft: '4px' }}>
                    <Chip variant={chipVariantFromProvider(row.payment_provider)} label={row.payment_provider} />
                  </span>
                )}
                <span style={{ marginLeft: '6px' }}>
                  {row.description}
                  <CreditBadge type={row.transaction_type} />
                  {row.notes && (
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '1px' }}>
                      {row.notes}
                    </span>
                  )}
                </span>
              </td>
              <td className="td-pct">{new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
              <td className="td-pct">{formatPct(txDisplayAmount(row), totalSpent)}</td>
              <td className="td-amt" style={txDisplayAmount(row) < 0 ? { color: '#34c759' } : undefined}>
                {formatCurrency(txDisplayAmount(row))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-foot">
            <td>Total</td>
            <td />
            <td className="td-pct" style={{ color: totalColor ?? 'var(--accent)' }}>
              {formatPct(total, totalSpent)}
            </td>
            <td className="td-amt" style={{ color: totalColor ?? 'var(--accent)' }}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Mobile list ── */}
      <div className="tx-list">
        {rows.map((row, i) => {
          const faded = row.date > todayStr
          const dateLabel = new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          return (
            <div
              key={i}
              className="tx-list-row"
              style={{ ...(faded ? { opacity: 0.35 } : {}), ...(onRowClick ? { cursor: 'pointer' } : {}) }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="tx-list-top">
                <div className="tx-list-left">
                  <Chip variant={chipVariantFromPm(row.payment_method)} />
                  {row.payment_provider && (
                    <span style={{ marginLeft: '4px' }}>
                      <Chip variant="ws" label={row.payment_provider} />
                    </span>
                  )}
                  <span className="tx-list-desc">
                    {row.description}
                    <CreditBadge type={row.transaction_type} />
                    {row.notes && (
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '1px' }}>
                        {row.notes}
                      </span>
                    )}
                  </span>
                </div>
                <span className="tx-list-amount" style={txDisplayAmount(row) < 0 ? { color: '#34c759' } : undefined}>
                  {formatCurrency(txDisplayAmount(row))}
                </span>
              </div>
              <div className="tx-list-sub">{dateLabel} · {formatPct(txDisplayAmount(row), totalSpent)}</div>
            </div>
          )
        })}
        <div className="tx-list-footer">
          <span>Total</span>
          <span style={{ color: totalColor ?? 'var(--accent)' }}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}
