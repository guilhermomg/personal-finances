'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addAccount } from '../lib/actions'
import { inputStyle, labelStyle } from './transactions/transaction-utils'
import type { Account } from '../types/finance'

type Props = {
  /** Existing bank accounts — a new credit card is paid from one of these. */
  bankAccounts: Account[]
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
}

export function AddAccountButton({ bankAccounts }: Props) {
  const router = useRouter()
  const todayStr = new Date().toISOString().split('T')[0]

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    accountType: 'bank_account' as 'bank_account' | 'credit_card',
    cycleStartDay: '6',
    paymentDueDay: '20',
    creditLimit: '',
    fundingAccountId: String(bankAccounts[0]?.id ?? ''),
    initialBalance: '0.00',
    initialBalanceDate: todayStr,
  })

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
  }

  function set<K extends keyof typeof form>(field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const isBank = form.accountType === 'bank_account'

  async function handleSave() {
    if (!form.name.trim()) { setError('Give the account a name'); return }

    const balance = parseFloat(form.initialBalance)
    if (isBank && isNaN(balance)) { setError('Enter a starting balance'); return }

    const limit = form.creditLimit.trim() === '' ? null : parseFloat(form.creditLimit)
    if (limit !== null && isNaN(limit)) { setError('Credit limit must be a number'); return }

    setSaving(true)
    setError(null)
    try {
      await addAccount({
        name: form.name.trim(),
        accountType: form.accountType,
        cycleStartDay: Number(form.cycleStartDay),
        paymentDueDay: isBank ? null : Number(form.paymentDueDay),
        creditLimit: isBank ? null : limit,
        fundingAccountId: isBank ? null : (Number(form.fundingAccountId) || null),
        initialBalance: isBank ? balance : null,
        initialBalanceDate: isBank ? form.initialBalanceDate : null,
      })
      router.refresh()
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add account')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Add an account"
        aria-label="Add an account"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '22px', height: '22px', background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: '6px',
          color: 'var(--muted)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: 0,
        }}
      >
        +
      </button>

      {open && (
        <div onClick={() => !saving && close()} style={overlayStyle}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '28px',
              maxHeight: '90vh', overflowY: 'auto',
              // Reset the font context inherited from .page-section-title.
              fontFamily: 'var(--font-mono), monospace', fontWeight: 400,
              letterSpacing: 'normal', textTransform: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
                Add Account
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
                <label style={labelStyle}>Name</label>
                <input
                  autoFocus
                  style={inputStyle}
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Tangerine Chequing"
                />
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                  Also used as the payment method on transactions, so it must be unique.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={form.accountType} onChange={set('accountType')}>
                  <option value="bank_account">Bank account</option>
                  <option value="credit_card">Credit card</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cycle starts on day</label>
                <select style={inputStyle} value={form.cycleStartDay} onChange={set('cycleStartDay')}>
                  {Array.from({ length: 27 }, (_, i) => i + 2).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                  The cycle runs to day {Number(form.cycleStartDay) - 1} of the following month.
                  Day 1 and days 29-31 are unavailable: the cycle needs a valid previous day,
                  and days 29-31 do not exist in every month.
                </p>
              </div>

              {!isBank && (
                <>
                  <div>
                    <label style={labelStyle}>Payment due (days after close)</label>
                    <input type="number" min="0" max="60" style={inputStyle}
                      value={form.paymentDueDay} onChange={set('paymentDueDay')} />
                  </div>

                  <div>
                    <label style={labelStyle}>Credit limit (optional)</label>
                    <input style={inputStyle} value={form.creditLimit} onChange={set('creditLimit')} placeholder="e.g. 5000" />
                  </div>

                  <div>
                    <label style={labelStyle}>Paid from</label>
                    <select style={inputStyle} value={form.fundingAccountId} onChange={set('fundingAccountId')}>
                      {bankAccounts.length === 0 && <option value="">No bank account yet</option>}
                      {bankAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.payment_method}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Each cycle's balance is charged to this account on its due date.
                    </p>
                  </div>
                </>
              )}

              {isBank && (
                <>
                  <div>
                    <label style={labelStyle}>Starting balance</label>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.initialBalance}
                      onChange={set('initialBalance')}
                      placeholder="0.00"
                    />
                    <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      May be negative if the account is overdrawn.
                    </p>
                  </div>

                  <div>
                    <label style={labelStyle}>Balance as of</label>
                    <input type="date" style={inputStyle}
                      value={form.initialBalanceDate} onChange={set('initialBalanceDate')} />
                    <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Balance tracking starts here. Anything before this date is not modelled,
                      so use a date you know the real balance for.
                    </p>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--danger)' }}>{error}</p>
            )}

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
                {saving ? 'Saving…' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
