'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransaction, updateRecurringTransaction, addCategory, deactivateRecurringTransaction } from '../../lib/actions'
import type { Transaction, PaymentMethodConfig } from '../../types/finance'
import { inputStyle, labelStyle } from './transaction-utils'
import { ConfirmModal } from '../ConfirmModal'

type Scope = 'next' | 'all-future'

type Props = {
  recurringTransactionId: number
  description: string
  category: string
  amount: number
  payment_method: string
  day_of_month?: number | null
  // When provided (from transactions list), enables "Next occurrence only" scope
  transaction?: Transaction
  allCategories: string[]
  allMethods: string[]
  paymentMethodConfigs: PaymentMethodConfig[]
  onClose: () => void
}

export function RecurringEditModal({
  recurringTransactionId,
  description: initDescription,
  category: initCategory,
  amount: initAmount,
  payment_method: initMethod,
  day_of_month: initDayOfMonth,
  transaction,
  allCategories,
  allMethods,
  onClose,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scope, setScope] = useState<Scope>(transaction ? 'next' : 'all-future')
  const [newCategoryMode, setNewCategoryMode] = useState(false)
  const [form, setForm] = useState({
    description: initDescription,
    category: initCategory,
    amount: String(initAmount),
    payment_method: initMethod,
    day_of_month: initDayOfMonth != null ? String(initDayOfMonth) : '',
    date: transaction?.date ?? '',
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    try {
      await deactivateRecurringTransaction(recurringTransactionId)
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
      setSaving(false)
    }
  }

  async function handleSave() {
    const amount = parseFloat(form.amount)
    if (!form.description.trim() || isNaN(amount) || amount < 0) {
      setError('Please fill in description and a valid amount')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (newCategoryMode && form.category.trim()) {
        await addCategory(form.category.trim())
      }

      if (scope === 'next' && transaction) {
        await updateTransaction(transaction.id, {
          description: form.description,
          category: form.category,
          amount,
          payment_method: form.payment_method,
          date: form.date || transaction.date,
          notes: transaction.notes,
          statement_date: transaction.statement_date,
        })
      } else {
        const dayOfMonth = form.day_of_month !== '' ? parseInt(form.day_of_month) : null
        await updateRecurringTransaction(recurringTransactionId, {
          description: form.description,
          category: form.category,
          amount,
          payment_method: form.payment_method,
          day_of_month: dayOfMonth != null && !isNaN(dayOfMonth) ? dayOfMonth : null,
        })
      }

      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  const tabBase: React.CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    padding: '6px 0',
    textAlign: 'center',
  }
  const tabActive: React.CSSProperties = {
    ...tabBase,
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontWeight: 600,
  }

  return (
    <div
      onClick={onClose}
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
          maxWidth: '460px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 28px 20px' }}>
          <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
            Edit Recurring Transaction
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Scope toggle — only shown when a specific transaction is available */}
        {transaction && (
          <div style={{
            display: 'flex',
            gap: '4px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '3px',
            margin: '0 28px 20px',
          }}>
            <button style={scope === 'next' ? tabActive : tabBase} onClick={() => setScope('next')}>
              This occurrence only
            </button>
            <button style={scope === 'all-future' ? tabActive : tabBase} onClick={() => setScope('all-future')}>
              This and all future
            </button>
          </div>
        )}

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={form.description} onChange={set('description')} />
            </div>

            <div>
              <label style={labelStyle}>Amount</label>
              <input type="number" step="0.01" min="0" style={inputStyle} value={form.amount} onChange={set('amount')} />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              {newCategoryMode ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    autoFocus
                    style={{ ...inputStyle, flex: 1 }}
                    value={form.category}
                    onChange={set('category')}
                    placeholder="New category name…"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryMode(false)
                      setForm(prev => ({ ...prev, category: allCategories[0] ?? '' }))
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}
                  >
                    ← Cancel
                  </button>
                </div>
              ) : (
                <select
                  style={inputStyle}
                  value={form.category}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      setNewCategoryMode(true)
                      setForm(prev => ({ ...prev, category: '' }))
                    } else {
                      set('category')(e)
                    }
                  }}
                >
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">＋ Add new category…</option>
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '4px' }}>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select style={inputStyle} value={form.payment_method} onChange={set('payment_method')}>
                  {allMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {scope === 'next' ? (
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.date}
                    onChange={set('date')}
                  />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    style={inputStyle}
                    value={form.day_of_month}
                    onChange={set('day_of_month')}
                    placeholder="e.g. 17"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scope hint */}
        <div style={{ padding: '12px 28px 0' }}>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
            {scope === 'next'
              ? 'Updates this transaction only. The recurring template stays unchanged.'
              : 'Updates the recurring template and all future occurrences from today.'}
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 28px' }}>
          {error && (
            <p style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--danger)' }}>{error}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '8px 16px',
              }}
            >
              Delete
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
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
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete Recurring Transaction"
          message="This will deactivate this recurring transaction and remove all future occurrences."
          confirmLabel="Confirm Delete"
          loading={saving}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
