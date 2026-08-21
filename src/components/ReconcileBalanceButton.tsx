'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reconcileAccountBalance } from '../lib/actions'
import { inputStyle, labelStyle } from './transactions/transaction-utils'
import { formatCurrency } from '../lib/format'

type Props = {
  accountId: number
  accountName: string
  currentBalance: number
}

// Snapping the tracked balance back to the real bank figure. Tracked balances
// drift — fees, interest, transactions never recorded — and re-anchoring is the
// correction: everything from the new date forward is recomputed, and history
// before it is left alone.
export function ReconcileBalanceButton({ accountId, accountName, currentBalance }: Props) {
  const router = useRouter()
  const todayStr = new Date().toISOString().split('T')[0]

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState(currentBalance.toFixed(2))
  const [asOfDate, setAsOfDate] = useState(todayStr)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) close() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, saving])

  function close() {
    setOpen(false)
    setError(null)
    setSaving(false)
    setBalance(currentBalance.toFixed(2))
    setAsOfDate(todayStr)
  }

  const parsed = parseFloat(balance)
  const difference = isNaN(parsed) ? 0 : parsed - currentBalance

  async function handleSave() {
    if (isNaN(parsed)) { setError('Enter a valid balance'); return }
    setSaving(true)
    setError(null)
    try {
      await reconcileAccountBalance(accountId, asOfDate, parsed, 'Reconciled against bank')
      router.refresh()
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reconcile')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
          color: 'var(--text)', cursor: 'pointer', fontSize: '11px', padding: '6px 12px',
        }}
      >
        Reconcile balance
      </button>

      {open && (
        <div
          onClick={() => !saving && close()}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px',
              width: '100%', maxWidth: '400px', padding: '28px',
              fontFamily: 'var(--font-mono), monospace', fontWeight: 400,
              letterSpacing: 'normal', textTransform: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
                Reconcile {accountName}
              </span>
              <button
                onClick={close}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Real balance</label>
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={labelStyle}>As of</label>
                <input type="date" style={inputStyle} value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
              </div>

              <div style={{
                fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5,
                padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px',
              }}>
                Tracked balance is {formatCurrency(currentBalance)}.{' '}
                {Math.abs(difference) < 0.005 ? (
                  <>No adjustment needed.</>
                ) : (
                  <>
                    This is a{' '}
                    <span style={{ color: difference < 0 ? 'var(--danger)' : 'var(--accent2)', fontWeight: 600 }}>
                      {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                    </span>{' '}
                    correction. Balances from this date forward are recomputed; earlier history is unchanged.
                  </>
                )}
              </div>
            </div>

            {error && <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--danger)' }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={close}
                disabled={saving}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
                  color: 'var(--muted)', cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '12px', padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'var(--accent)', border: 'none', borderRadius: '8px',
                  color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 600, opacity: saving ? 0.6 : 1, padding: '8px 20px',
                }}
              >
                {saving ? 'Saving…' : 'Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
