'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTransaction, updateTransaction, deleteTransaction, addInstallments, addCategory, addBillingCyclePayment } from '../../lib/actions'
import type { Transaction, Account } from '../../types/finance'
import { OneTimeForm, type OneTimeFormHandle } from './OneTimeForm'
import { InstallmentsForm, type InstallmentsFormHandle } from './InstallmentsForm'
import { RefundCashbackForm, type RefundCashbackFormHandle } from './RefundCashbackForm'
import { PaymentForm, type PaymentFormHandle, type PaymentCard } from './PaymentForm'

type Props = {
  transaction?: Transaction
  allCategories: string[]
  incomeCategories: string[]
  allMethods: string[]
  allProviders: string[]
  accounts: Account[]
  creditCards?: PaymentCard[]
  onClose: () => void
}

type Mode = 'onetime' | 'installments' | 'refund' | 'payment'

export function TransactionModal({ transaction, allCategories, incomeCategories, allMethods, allProviders, accounts, creditCards = [], onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('onetime')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isNew = !transaction

  const oneTimeRef = useRef<OneTimeFormHandle>(null)
  const installmentsRef = useRef<InstallmentsFormHandle>(null)
  const refundRef = useRef<RefundCashbackFormHandle>(null)
  const paymentRef = useRef<PaymentFormHandle>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || deleting) return
      if (confirmingDelete) setConfirmingDelete(false)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, confirmingDelete, deleting])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (!isNew || mode === 'onetime') {
        const result = oneTimeRef.current?.getValues()
        if (!result) { setError('Please fill in description, a valid amount, and category splits that add up'); setSaving(false); return }
        const { data, newCategories } = result
        for (const c of newCategories) await addCategory(c)
        if (isNew) {
          await addTransaction(data)
        } else {
          await updateTransaction(transaction.id, data)
        }
      } else if (mode === 'installments') {
        const result = installmentsRef.current?.getValues()
        if (!result) { setError('Please fill in description, total amount (≥ 0), and at least 2 installments'); setSaving(false); return }
        const { items, newCategoryToAdd } = result
        if (newCategoryToAdd) await addCategory(newCategoryToAdd)
        await addInstallments(items)
      } else if (mode === 'refund') {
        const result = refundRef.current?.getValues()
        if (!result) { setError('Please fill in a valid amount'); setSaving(false); return }
        const { data, newCategoryToAdd } = result
        if (newCategoryToAdd) await addCategory(newCategoryToAdd.name, newCategoryToAdd.kind)
        await addTransaction(data)
      } else {
        const result = paymentRef.current?.getValues()
        if (!result) { setError('Please select a card and fill in a valid amount'); setSaving(false); return }
        await addBillingCyclePayment(
          result.cycleId, result.amount, result.paymentDate, result.notes, result.fundingAccountId,
        )
      }
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!transaction) return
    setDeleting(true)
    setError(null)
    try {
      await deleteTransaction(transaction.id)
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
      setDeleting(false)
      setConfirmingDelete(false)
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
            {isNew ? 'Add Transaction' : 'Edit Transaction'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Mode toggle — new transactions only */}
        {isNew && (
          <div style={{
            display: 'flex',
            gap: '4px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '3px',
            margin: '0 28px 20px',
          }}>
            <button style={mode === 'onetime' ? tabActive : tabBase} onClick={() => setMode('onetime')}>
              One-time
            </button>
            <button style={mode === 'installments' ? tabActive : tabBase} onClick={() => setMode('installments')}>
              Installments
            </button>
            <button style={mode === 'refund' ? tabActive : tabBase} onClick={() => setMode('refund')}>
              Money In
            </button>
            {creditCards.length > 0 && (
              <button style={mode === 'payment' ? tabActive : tabBase} onClick={() => setMode('payment')}>
                Payment
              </button>
            )}
          </div>
        )}

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
          {(!isNew || mode === 'onetime') ? (
            <OneTimeForm
              ref={oneTimeRef}
              allCategories={allCategories}
              allMethods={allMethods}
              accounts={accounts}
              initialData={transaction}
            />
          ) : mode === 'installments' ? (
            <InstallmentsForm
              ref={installmentsRef}
              allCategories={allCategories}
              allMethods={allMethods}
              allProviders={allProviders}
              accounts={accounts}
            />
          ) : mode === 'refund' ? (
            <RefundCashbackForm
              ref={refundRef}
              allCategories={allCategories}
              incomeCategories={incomeCategories}
              allMethods={allMethods}
              accounts={accounts}
            />
          ) : (
            <PaymentForm
              ref={paymentRef}
              creditCards={creditCards}
              accounts={accounts}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 28px' }}>
          {error && (
            <p style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--danger)' }}>{error}</p>
          )}
          <div style={{ display: 'flex', justifyContent: !isNew ? 'space-between' : 'flex-end', alignItems: 'center', gap: '8px' }}>
            {!isNew && (
              <button
                onClick={() => setConfirmingDelete(true)}
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
            )}
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
              {saving ? 'Saving…' : !isNew ? 'Save' : mode === 'installments' ? 'Add Installments' : mode === 'refund' ? 'Add Money In' : mode === 'payment' ? 'Add Payment' : 'Add'}
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div
          onClick={e => { e.stopPropagation(); if (!deleting) setConfirmingDelete(false) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 110,
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
              maxWidth: '360px',
              padding: '28px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
              Delete transaction?
            </span>
            <p style={{ margin: '12px 0 20px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {transaction?.description ? `“${transaction.description}” will be permanently removed. ` : ''}
              This can&rsquo;t be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: 'var(--danger)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  opacity: deleting ? 0.6 : 1,
                  padding: '8px 20px',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
