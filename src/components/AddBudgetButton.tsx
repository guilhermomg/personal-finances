'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertBudgetForward } from '../lib/actions'
import { inputStyle, labelStyle } from './transactions/transaction-utils'
import { AmountInput } from './transactions/AmountInput'

type Props = {
  billingPeriodId: number
  /** Active categories that don't have a budget yet. */
  availableCategories: string[]
}

export function AddBudgetButton({ billingPeriodId, availableCategories }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('0.00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, saving])

  function close() {
    setOpen(false)
    setCategory('')
    setAmount('0.00')
    setError(null)
  }

  async function handleSave() {
    const value = parseFloat(amount)
    if (!category) { setError('Pick a category'); return }
    if (isNaN(value) || value <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError(null)
    try {
      await upsertBudgetForward(billingPeriodId, category, value)
      router.refresh()
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save budget')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Add a category budget"
        aria-label="Add a category budget"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '22px',
          height: '22px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: '15px',
          lineHeight: 1,
          padding: 0,
        }}
      >
        +
      </button>

      {open && (
        <div
          onClick={() => !saving && close()}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              padding: '28px',
              // Reset the font context inherited from .page-section-title (Syne,
              // uppercase, letter-spacing) back to the app default so this modal
              // matches the other transaction modals.
              fontFamily: 'var(--font-mono), monospace',
              fontWeight: 400,
              letterSpacing: 'normal',
              textTransform: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
                Add Category Budget
              </span>
              <button
                onClick={close}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {availableCategories.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 8px' }}>
                Every category already has a budget.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="" disabled>Select a category…</option>
                    {availableCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Monthly Budget</label>
                  <AmountInput
                    value={amount}
                    onValueChange={setAmount}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  />
                </div>

                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Applies to this period and all future periods.
                </p>
              </div>
            )}

            {error && (
              <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--danger)' }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={close}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              {availableCategories.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--bg)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                    padding: '8px 20px',
                  }}
                >
                  {saving ? 'Saving…' : 'Add Budget'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
