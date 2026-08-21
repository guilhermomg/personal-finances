import Link from 'next/link'
import { getAccountBalances, getBalanceOutlook } from '../lib/balances'
import { getAccounts } from '../lib/finance'
import { formatCurrency } from '../lib/format'
import { ReconcileBalanceButton } from '../components/ReconcileBalanceButton'

function dayLabel(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function AccountBalancesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const accountId = Number(id)

  const [accounts, outlook, balances] = await Promise.all([
    getAccounts(),
    getBalanceOutlook(accountId),
    getAccountBalances(accountId),
  ])
  const account = accounts.find(a => a.id === accountId)

  if (!account) {
    return <p style={{ color: 'var(--muted)' }}>Account not found.</p>
  }

  if (!outlook) {
    return (
      <div>
        <div className="page-section-title">{account.payment_method}</div>
        <p style={{ color: 'var(--muted)' }}>
          No balance tracking yet — this account needs a starting balance before its
          history can be built.
        </p>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  // Newest first from the query; show recent history and the projection around
  // today rather than dumping two years of rows.
  const past = balances.filter(b => b.date <= today).slice(0, 30).reverse()
  const future = balances.filter(b => b.date > today).reverse().slice(0, 60)
  const rows = [...past, ...future]

  return (
    <>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <Link href="/finances" style={{ color: 'var(--muted)', fontSize: '12px', textDecoration: 'none' }}>
          ← Finances
        </Link>
        <ReconcileBalanceButton
          accountId={accountId}
          accountName={account.payment_method}
          currentBalance={outlook.current}
        />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="card-label">Balance today</div>
          <div className="big-num" style={outlook.current < 0 ? { color: 'var(--danger)' } : undefined}>
            {formatCurrency(outlook.current)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
            as of {dayLabel(outlook.currentDate)}
          </div>
        </div>

        {outlook.low && (
          <div className="card">
            <div className="card-label">Low point (60 days)</div>
            <div className="big-num" style={outlook.low.balance < 0 ? { color: 'var(--danger)' } : undefined}>
              {formatCurrency(outlook.low.balance)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
              on {dayLabel(outlook.low.date)}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-label">Projected</div>
          <div className="big-num" style={outlook.endOfHorizon < 0 ? { color: 'var(--danger)' } : undefined}>
            {formatCurrency(outlook.endOfHorizon)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
            by {dayLabel(outlook.horizonEnd)}
          </div>
        </div>
      </div>

      <div className="page-section">
        <div className="page-section-title">{account.payment_method} · balance history</div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-6px', marginBottom: '14px', lineHeight: 1.5 }}>
          One row per day with activity. Dates after today are projected: they include
          scheduled income, installments and credit-card payments due, but not
          discretionary spending that has not happened yet — so the further out a row
          sits, the more optimistic it is.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="td-amt">Opening</th>
                <th className="td-amt">In</th>
                <th className="td-amt">Out</th>
                <th className="td-amt">Closing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isFuture = r.date > today
                return (
                  <tr key={r.date} style={isFuture ? { opacity: 0.72 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dayLabel(r.date)}
                      {r.date === today && (
                        <span style={{ marginLeft: '8px', fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                          TODAY
                        </span>
                      )}
                    </td>
                    <td className="td-amt" style={{ color: 'var(--muted)' }}>{formatCurrency(r.opening_balance)}</td>
                    <td className="td-amt" style={r.inflow > 0 ? { color: '#34c759' } : { color: 'var(--muted)' }}>
                      {r.inflow > 0 ? formatCurrency(r.inflow) : '—'}
                    </td>
                    <td className="td-amt" style={r.outflow > 0 ? undefined : { color: 'var(--muted)' }}>
                      {r.outflow > 0 ? formatCurrency(r.outflow) : '—'}
                    </td>
                    <td className="td-amt" style={{
                      fontWeight: 600,
                      color: r.closing_balance < 0 ? 'var(--danger)' : 'var(--text)',
                    }}>
                      {formatCurrency(r.closing_balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
