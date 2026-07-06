'use client'

import { useImperativeHandle, useState } from 'react'
import type { Transaction, PaymentMethodConfig } from '../../types/finance'
import {
  isCreditCard,
  getBillingCycleOptions,
  getDefaultStatementDate,
  inputStyle,
  labelStyle,
} from './transaction-utils'
import { AmountInput, toAmountString } from './AmountInput'

export type OneTimeFormData = {
  description: string
  date: string
  category: string
  payment_method: string
  amount: number
  notes: string | null
  statement_date: string | null
}

export type OneTimeFormHandle = {
  getValues(): { data: OneTimeFormData; newCategoryToAdd: string | null } | null
}

type Props = {
  ref?: React.Ref<OneTimeFormHandle>
  allCategories: string[]
  allMethods: string[]
  paymentMethodConfigs: PaymentMethodConfig[]
  initialData?: Transaction
}

export function OneTimeForm({ ref, allCategories, allMethods, paymentMethodConfigs, initialData }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const initPm = initialData?.payment_method ?? allMethods[0] ?? ''
  const initDate = initialData?.date ?? todayStr

  function initStatementDate(): string {
    if (!isCreditCard(initPm, paymentMethodConfigs)) return ''
    if (initialData?.statement_date) return initialData.statement_date
    return getDefaultStatementDate(initDate, initPm, paymentMethodConfigs)
  }

  const [form, setForm] = useState({
    description: initialData?.description ?? '',
    date: initDate,
    category: initialData?.category ?? allCategories[0] ?? '',
    payment_method: initPm,
    amount: toAmountString(initialData?.amount),
    notes: initialData?.notes ?? '',
    statement_date: initStatementDate(),
  })
  const [newCategoryMode, setNewCategoryMode] = useState(false)

  useImperativeHandle(ref, () => ({
    getValues() {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount < 0) return null
      if (!form.description.trim()) return null
      return {
        data: {
          description: form.description,
          date: form.date,
          category: form.category,
          payment_method: form.payment_method,
          amount,
          notes: form.notes || null,
          statement_date: form.statement_date || null,
        },
        newCategoryToAdd: newCategoryMode ? form.category : null,
      }
    },
  }), [form, newCategoryMode])

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

  const billingCycleOptions = isCreditCard(form.payment_method, paymentMethodConfigs)
    ? getBillingCycleOptions(form.date || todayStr, form.payment_method, paymentMethodConfigs)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>Description</label>
        <input style={inputStyle} value={form.description} onChange={set('description')} />
      </div>

      <div>
        <label style={labelStyle}>Date</label>
        <input type="date" style={inputStyle} value={form.date} onChange={set('date')} />
      </div>

      <div>
        <label style={labelStyle}>Amount</label>
        <AmountInput value={form.amount} onValueChange={v => setForm(prev => ({ ...prev, amount: v }))} />
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

      <div>
        <label style={labelStyle}>Payment Method</label>
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
