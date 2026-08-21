import { formatCurrency, formatPct, txDisplaySign, txTypeLabel, txIsCredit } from '../lib/format'
import { Chip } from './Chip'
import { chipProps } from './chipUtils'
import type { TransactionRow, PaymentStyleMap, TransactionType } from '../types/finance'

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

const neutralBadgeStyle: React.CSSProperties = {
  ...creditBadgeStyle,
  background: 'var(--surface2)',
  color: 'var(--muted)',
  border: '1px solid var(--border)',
}

// How a row's amount is displayed.
//
//   'signed'    — credits are negated, so they read as offsets against the
//                 spending the table is about. Right for a mixed table.
//   'magnitude' — amounts as stored. Right when every row points the same way
//                 (an Income table), where negating each row would contradict
//                 the positive total in the footer.
export type AmountSign = 'signed' | 'magnitude'

function txDisplayAmount(row: TransactionRow, mode: AmountSign = 'signed') {
  return mode === 'magnitude' ? row.amount : txDisplaySign(row.transaction_type) * row.amount
}

function CreditBadge({ type }: { type?: TransactionType }) {
  const label = txTypeLabel(type)
  if (!label) return null
  // Transfers move money out without being spend, so they read neutral rather
  // than borrowing the green used for money arriving.
  return <span style={txIsCredit(type) ? creditBadgeStyle : neutralBadgeStyle}>{label}</span>
}

type Props = {
  title: string
  dotColor: string
  rows: TransactionRow[]
  total: number
  totalSpent: number
  totalColor?: string
  paymentStyles: PaymentStyleMap
  onRowClick?: (row: TransactionRow) => void
  amountSign?: AmountSign
}

export function TransactionTable({ title, dotColor, rows, total, totalSpent, totalColor, paymentStyles, onRowClick, amountSign = 'signed' }: Props) {
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
                <Chip {...chipProps(paymentStyles, row.payment_method)} />
                {row.payment_provider && (
                  <span style={{ marginLeft: '4px' }}>
                    <Chip {...chipProps(paymentStyles, row.payment_provider)} />
                  </span>
                )}
                <span style={{ marginLeft: '6px' }}>
                  {row.description}
                  {amountSign === 'signed' && <CreditBadge type={row.transaction_type} />}
                  {row.notes && (
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '1px' }}>
                      {row.notes}
                    </span>
                  )}
                </span>
              </td>
              <td className="td-pct">{new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
              <td className="td-pct">{formatPct(txDisplayAmount(row, amountSign), totalSpent)}</td>
              {/* Money arriving reads green whichever way the amount is signed. */}
              <td className="td-amt" style={txIsCredit(row.transaction_type) ? { color: '#34c759' } : undefined}>
                {formatCurrency(txDisplayAmount(row, amountSign))}
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
                  <Chip {...chipProps(paymentStyles, row.payment_method)} />
                  {row.payment_provider && (
                    <span style={{ marginLeft: '4px' }}>
                      <Chip {...chipProps(paymentStyles, row.payment_provider)} />
                    </span>
                  )}
                  <span className="tx-list-desc">
                    {row.description}
                    {amountSign === 'signed' && <CreditBadge type={row.transaction_type} />}
                    {row.notes && (
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '1px' }}>
                        {row.notes}
                      </span>
                    )}
                  </span>
                </div>
                <span className="tx-list-amount" style={txIsCredit(row.transaction_type) ? { color: '#34c759' } : undefined}>
                  {formatCurrency(txDisplayAmount(row, amountSign))}
                </span>
              </div>
              <div className="tx-list-sub">{dateLabel} · {formatPct(txDisplayAmount(row, amountSign), totalSpent)}</div>
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
