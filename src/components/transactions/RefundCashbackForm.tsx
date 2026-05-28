'use client'

import { useImperativeHandle, useState } from 'react'
import type { PaymentMethodConfig } from '../../types/finance'
import {
  isCreditCard,
  getBillingCycleOptions,
  getDefaultStatementDate,
  inputStyle,
  labelStyle,
} from './transaction-utils'

export type RefundCashbackFormData = {
  description: string
  date: string
  category: string
  payment_method: string
  amount: number
  notes: string | null
  statement_date: string | null
  transaction_type: 'refund' | 'cashback'
  refund_for_transaction_id: null
}

export type RefundCashbackFormHandle = {
  getValues(): { data: RefundCashbackFormData; newCategoryToAdd: string | null } | null
}

type Props = {
  ref?: React.Ref<RefundCashbackFormHandle>
  allCategories: string[]
  allMethods: string[]
  paymentMethodConfigs: PaymentMethodConfig[]
}

export function RefundCashbackForm({ ref, allCategories, allMethods, paymentMethodConfigs }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const initPm = allMethods[0] ?? ''

  const [type, setType] = useState<'refund' | 'cashback'>('refund')
  const [newCategoryMode, setNewCategoryMode] = useState(false)
  const [form, setForm] = useState({
    description: '',
    date: todayStr,
    category: allCategories[0] ?? '',
    payment_method: initPm,
    amount: '',
    notes: '',
    statement_date: isCreditCard(initPm, paymentMethodConfigs)
      ? getDefaultStatementDate(todayStr, initPm, paymentMethodConfigs)
      : '',
  })

  useImperativeHandle(ref, () => ({
    getValues() {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount <= 0) return null
      const category = type === 'cashback' ? (form.category || 'Cashback') : form.category
      if (!category.trim()) return null
      return {
        data: {
          description: form.description || (type === 'cashback' ? 'Cashback' : 'Refund'),
          date: form.date,
          category,
          payment_method: form.payment_method,
          amount,
          notes: form.notes || null,
          statement_date: form.statement_date || null,
          transaction_type: type,
          refund_for_transaction_id: null,
        },
        newCategoryToAdd: newCategoryMode ? form.category : (type === 'cashback' && !allCategories.includes('Cashback') ? 'Cashback' : null),
      }
    },
  }), [form, type, newCategoryMode, allCategories])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => {
        const updated = { ...prev, [field]: e.target.value }
        if (field === 'payment_method') {
          const pm = e.target.value
          updated.statement_date = isCreditCard(pm, paymentMethodConfigs)
            ? getDefaultStatementDate(prev.date || todayStr, pm, paymentMethodConfigs)
            : ''
        } else if (field === 'date') {
          const dateStr = e.target.value || todayStr
          updated.statement_date = isCreditCard(prev.payment_method, paymentMethodConfigs)
            ? getDefaultStatementDate(dateStr, prev.payment_method, paymentMethodConfigs)
            : ''
        }
        return updated
      })
    }
  }

  function handleTypeChange(next: 'refund' | 'cashback') {
    setType(next)
    setNewCategoryMode(false)
    setForm(prev => ({
      ...prev,
      category: next === 'cashback' ? 'Cashback' : (allCategories[0] ?? ''),
    }))
  }

  const billingCycleOptions = isCreditCard(form.payment_method, paymentMethodConfigs)
    ? getBillingCycleOptions(form.date || todayStr, form.payment_method, paymentMethodConfigs)
    : []

  const typeTabBase: React.CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    padding: '5px 0',
  }
  const typeTabActive: React.CSSProperties = {
    ...typeTabBase,
    background: type === 'cashback' ? 'rgba(52,199,89,0.15)' : 'var(--surface2)',
    color: type === 'cashback' ? 'var(--success, #34c759)' : 'var(--text)',
    fontWeight: 600,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Refund vs Cashback toggle */}
      <div style={{
        display: 'flex',
        gap: '4px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '3px',
      }}>
        <button style={type === 'refund' ? typeTabActive : typeTabBase} onClick={() => handleTypeChange('refund')}>
          Refund
        </button>
        <button style={type === 'cashback' ? typeTabActive : typeTabBase} onClick={() => handleTypeChange('cashback')}>
          Cashback
        </button>
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <input
          style={inputStyle}
          value={form.description}
          onChange={set('description')}
          placeholder={type === 'cashback' ? 'e.g. Amex cashback reward' : 'e.g. Return – Zara jacket'}
        />
      </div>

      <div>
        <label style={labelStyle}>Date</label>
        <input type="date" style={inputStyle} value={form.date} onChange={set('date')} />
      </div>

      <div>
        <label style={labelStyle}>Amount</label>
        <input type="number" step="0.01" min="0" style={inputStyle} value={form.amount} onChange={set('amount')} />
      </div>

      {/* Category — free choice for refunds, locked to Cashback for cashbacks */}
      <div>
        <label style={labelStyle}>Category</label>
        {type === 'cashback' ? (
          <input style={{ ...inputStyle, color: 'var(--muted)' }} value="Cashback" readOnly />
        ) : newCategoryMode ? (
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

      <div>
        <label style={labelStyle}>Card / Account</label>
        <select style={inputStyle} value={form.payment_method} onChange={set('payment_method')}>
          {allMethods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {billingCycleOptions.length > 0 && (
        <div>
          <label style={labelStyle}>Billing Cycle</label>
          <select
            style={inputStyle}
            value={form.statement_date}
            onChange={e => setForm(prev => ({ ...prev, statement_date: e.target.value }))}
          >
            {billingCycleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: '72px', fontFamily: 'inherit' }}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Optional note…"
        />
      </div>
    </div>
  )
}
