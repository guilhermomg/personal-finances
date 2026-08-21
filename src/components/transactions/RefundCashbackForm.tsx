'use client'

import { useImperativeHandle, useState } from 'react'
import type { Account, CategoryKind } from '../../types/finance'
import {
  isCreditCard,
  getBillingCycleOptions,
  getDefaultStatementDate,
  inputStyle,
  labelStyle,
} from './transaction-utils'
import { AmountInput } from './AmountInput'

// Refund and cashback offset spending; income is new money arriving. All three
// are "money in" from the form's point of view, which is why they share it —
// but only income is excluded from spend totals (see isSpend in lib/finance).
export type MoneyInType = 'refund' | 'cashback' | 'income'

// Cashback is the one type whose category is pinned rather than chosen.
const FIXED_CATEGORY: Partial<Record<MoneyInType, string>> = {
  cashback: 'Cashback',
}

// Income is classified with income categories (Salary, Interest, Gift…);
// refunds are classified with the expense categories they offset.
function categoryKindFor(type: MoneyInType): CategoryKind {
  return type === 'income' ? 'income' : 'expense'
}

export type RefundCashbackFormData = {
  description: string
  date: string
  category: string
  payment_method: string
  amount: number
  notes: string | null
  statement_date: string | null
  transaction_type: 'refund' | 'cashback' | 'income'
  refund_for_transaction_id: null
}

export type RefundCashbackFormHandle = {
  getValues(): {
    data: RefundCashbackFormData
    newCategoryToAdd: { name: string; kind: CategoryKind } | null
  } | null
}

type Props = {
  ref?: React.Ref<RefundCashbackFormHandle>
  allCategories: string[]
  incomeCategories: string[]
  allMethods: string[]
  accounts: Account[]
}

export function RefundCashbackForm({ ref, allCategories, incomeCategories, allMethods, accounts }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const initPm = allMethods[0] ?? ''

  const [type, setType] = useState<MoneyInType>('refund')
  const [newCategoryMode, setNewCategoryMode] = useState(false)
  const [form, setForm] = useState({
    description: '',
    date: todayStr,
    category: allCategories[0] ?? '',
    payment_method: initPm,
    amount: '0.00',
    notes: '',
    statement_date: isCreditCard(initPm, accounts)
      ? getDefaultStatementDate(todayStr, initPm, accounts)
      : '',
  })

  // Options for the category picker, per active tab.
  const categoryOptions = type === 'income' ? incomeCategories : allCategories

  useImperativeHandle(ref, () => ({
    getValues() {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount <= 0) return null
      const fixed = FIXED_CATEGORY[type]
      const category = fixed ?? form.category
      if (!category.trim()) return null
      return {
        data: {
          description: form.description || (type === 'income' ? 'Income' : fixed ?? 'Refund'),
          date: form.date,
          category,
          payment_method: form.payment_method,
          amount,
          notes: form.notes || null,
          statement_date: form.statement_date || null,
          transaction_type: type,
          refund_for_transaction_id: null,
        },
        newCategoryToAdd: newCategoryMode
          ? { name: form.category, kind: categoryKindFor(type) }
          : (fixed && !allCategories.includes(fixed) ? { name: fixed, kind: categoryKindFor(type) } : null),
      }
    },
  }), [form, type, newCategoryMode, allCategories, incomeCategories])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => {
        const updated = { ...prev, [field]: e.target.value }
        if (field === 'payment_method') {
          const pm = e.target.value
          updated.statement_date = isCreditCard(pm, accounts)
            ? getDefaultStatementDate(prev.date || todayStr, pm, accounts)
            : ''
        } else if (field === 'date') {
          const dateStr = e.target.value || todayStr
          updated.statement_date = isCreditCard(prev.payment_method, accounts)
            ? getDefaultStatementDate(dateStr, prev.payment_method, accounts)
            : ''
        }
        return updated
      })
    }
  }

  function handleTypeChange(next: MoneyInType) {
    setType(next)
    setNewCategoryMode(false)
    setForm(prev => ({
      ...prev,
      category: FIXED_CATEGORY[next]
        ?? ((next === 'income' ? incomeCategories : allCategories)[0] ?? ''),
    }))
  }

  const billingCycleOptions = isCreditCard(form.payment_method, accounts)
    ? getBillingCycleOptions(form.date || todayStr, form.payment_method, accounts)
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
    background: type === 'refund' ? 'var(--surface2)' : 'rgba(52,199,89,0.15)',
    color: type === 'refund' ? 'var(--text)' : 'var(--success, #34c759)',
    fontWeight: 600,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Refund vs Cashback vs Income toggle */}
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
        <button style={type === 'income' ? typeTabActive : typeTabBase} onClick={() => handleTypeChange('income')}>
          Income
        </button>
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <input
          style={inputStyle}
          value={form.description}
          onChange={set('description')}
          placeholder={
            type === 'cashback' ? 'e.g. card cashback reward'
            : type === 'income' ? 'e.g. Paycheck – Acme Corp'
            : 'e.g. Return – jacket'
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Date</label>
        <input type="date" style={inputStyle} value={form.date} onChange={set('date')} />
      </div>

      <div>
        <label style={labelStyle}>Amount</label>
        <AmountInput value={form.amount} onValueChange={v => setForm(prev => ({ ...prev, amount: v }))} />
      </div>

      {/* Category — pinned for cashback, otherwise picked from the tab's vocabulary */}
      <div>
        <label style={labelStyle}>Category</label>
        {FIXED_CATEGORY[type] ? (
          <input style={{ ...inputStyle, color: 'var(--muted)' }} value={FIXED_CATEGORY[type]} readOnly />
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
                setForm(prev => ({ ...prev, category: categoryOptions[0] ?? '' }))
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
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
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
