'use client'

import { useImperativeHandle, useState } from 'react'
import type { Transaction, TransactionAllocation, Account } from '../../types/finance'
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
  categories: TransactionAllocation[]
}

export type OneTimeFormHandle = {
  getValues(): { data: OneTimeFormData; newCategories: string[] } | null
}

type Props = {
  ref?: React.Ref<OneTimeFormHandle>
  allCategories: string[]
  allMethods: string[]
  accounts: Account[]
  initialData?: Transaction
}

// One category-split row in the editor. `isNew` marks a row whose category is
// being typed as a brand-new category (not yet in `allCategories`).
type CatRow = { category: string; amount: string; isNew: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100

export function OneTimeForm({ ref, allCategories, allMethods, accounts, initialData }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const initPm = initialData?.payment_method ?? allMethods[0] ?? ''
  const initDate = initialData?.date ?? todayStr

  function initStatementDate(): string {
    if (!isCreditCard(initPm, accounts)) return ''
    if (initialData?.statement_date) return initialData.statement_date
    return getDefaultStatementDate(initDate, initPm, accounts)
  }

  const [form, setForm] = useState({
    description: initialData?.description ?? '',
    date: initDate,
    payment_method: initPm,
    amount: toAmountString(initialData?.amount),
    notes: initialData?.notes ?? '',
    statement_date: initStatementDate(),
  })

  // Category splits. Single-category (the common case) keeps a single row and no
  // amount entry; splitting reveals per-row amounts with the last row absorbing
  // the remainder.
  const [rows, setRows] = useState<CatRow[]>(() =>
    initialData?.allocations && initialData.allocations.length > 0
      ? initialData.allocations.map(a => ({ category: a.category, amount: toAmountString(a.amount), isNew: false }))
      : [{ category: initialData?.category ?? allCategories[0] ?? '', amount: '', isNew: false }],
  )

  const total = parseFloat(form.amount) || 0
  const split = rows.length > 1
  // Every amount is editable. A single row left blank auto-absorbs the remainder;
  // if the user fills them all, they just have to add up to the total.
  const blankIdxs = rows.map((r, i) => (r.amount.trim() === '' ? i : -1)).filter(i => i >= 0)
  const filledSum = rows.reduce((s, r) => s + (r.amount.trim() === '' ? 0 : parseFloat(r.amount) || 0), 0)
  const remainder = round2(total - filledSum)
  const balanced =
    remainder >= 0 && (blankIdxs.length === 1 || (blankIdxs.length === 0 && Math.abs(remainder) < 0.005))

  useImperativeHandle(ref, () => ({
    getValues() {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount < 0) return null
      if (!form.description.trim()) return null

      let categories: TransactionAllocation[]
      if (!split) {
        const cat = rows[0].category.trim()
        if (!cat) return null
        categories = [{ category: cat, amount }]
      } else {
        if (rows.some(r => !r.category.trim())) return null
        const blanks = rows.map((r, i) => (r.amount.trim() === '' ? i : -1)).filter(i => i >= 0)
        if (blanks.length > 1) return null // can't infer more than one missing amount

        let amounts: number[]
        if (blanks.length === 0) {
          amounts = rows.map(r => parseFloat(r.amount))
          if (amounts.some(a => isNaN(a) || a < 0)) return null
          if (Math.abs(amounts.reduce((s, a) => s + a, 0) - amount) > 0.005) return null
        } else {
          const bi = blanks[0]
          amounts = rows.map((r, i) => (i === bi ? 0 : parseFloat(r.amount)))
          if (amounts.some((a, i) => i !== bi && (isNaN(a) || a < 0))) return null
          const rem = round2(amount - amounts.reduce((s, a) => s + a, 0))
          if (rem < 0) return null
          amounts[bi] = rem
        }
        categories = rows
          .map((r, i) => ({ category: r.category.trim(), amount: round2(amounts[i]) }))
          .filter(c => c.amount > 0)
        if (categories.length === 0) return null
      }

      const primary = categories.reduce((m, c) => (c.amount > m.amount ? c : m), categories[0]).category
      const newCategories = [...new Set(rows.filter(r => r.isNew && r.category.trim()).map(r => r.category.trim()))]

      return {
        data: {
          description: form.description,
          date: form.date,
          category: primary,
          payment_method: form.payment_method,
          amount,
          notes: form.notes || null,
          statement_date: form.statement_date || null,
          categories,
        },
        newCategories,
      }
    },
  }), [form, rows, split])

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

  function patchRow(idx: number, patch: Partial<CatRow>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function firstUnusedCategory(used: Set<string>): string {
    return allCategories.find(c => !used.has(c)) ?? allCategories[0] ?? ''
  }

  function startSplit() {
    setRows(prev => {
      const used = new Set([prev[0].category])
      // Two blank amount rows — type one and leave the other blank to auto-fill it.
      return [{ ...prev[0], amount: '' }, { category: firstUnusedCategory(used), amount: '', isNew: false }]
    })
  }

  function addRow() {
    setRows(prev => {
      const used = new Set(prev.map(r => r.category))
      return [...prev, { category: firstUnusedCategory(used), amount: '', isNew: false }]
    })
  }

  function removeRow(idx: number) {
    setRows(prev => {
      if (prev.length <= 2) {
        // Collapse back to single-category — keep the other row's category.
        const keep = prev[idx === 0 ? 1 : 0]
        return [{ category: keep.category, amount: '', isNew: keep.isNew }]
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  function renderCategoryField(row: CatRow, idx: number, style: React.CSSProperties) {
    if (row.isNew) {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
          <input
            autoFocus
            style={{ ...style, flex: 1 }}
            value={row.category}
            onChange={e => patchRow(idx, { category: e.target.value })}
            placeholder="New category name…"
          />
          <button
            type="button"
            onClick={() => patchRow(idx, { isNew: false, category: allCategories[0] ?? '' })}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}
          >
            ← Cancel
          </button>
        </div>
      )
    }
    return (
      <select
        style={style}
        value={row.category}
        onChange={e => {
          if (e.target.value === '__new__') patchRow(idx, { isNew: true, category: '' })
          else patchRow(idx, { category: e.target.value })
        }}
      >
        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        <option value="__new__">＋ Add new category…</option>
      </select>
    )
  }

  const billingCycleOptions = isCreditCard(form.payment_method, accounts)
    ? getBillingCycleOptions(form.date || todayStr, form.payment_method, accounts)
    : []

  const splitLinkStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
    fontSize: '11px', fontWeight: 500, padding: 0, marginTop: '8px',
  }

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

        {!split ? (
          <>
            {renderCategoryField(rows[0], 0, inputStyle)}
            <button type="button" onClick={startSplit} style={splitLinkStyle}>
              ＋ Split across categories
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((row, idx) => {
              const soleBlank = blankIdxs.length === 1 && blankIdxs[0] === idx
              return (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {renderCategoryField(row, idx, { ...inputStyle, flex: 1 })}
                  <AmountInput
                    value={row.amount}
                    onValueChange={v => patchRow(idx, { amount: v })}
                    style={{ ...inputStyle, width: '96px', flexShrink: 0, textAlign: 'right' }}
                    placeholder={soleBlank ? remainder.toFixed(2) : '0.00'}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    aria-label="Remove category"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              )
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <button type="button" onClick={addRow} style={{ ...splitLinkStyle, marginTop: 0 }}>
                ＋ Add category
              </button>
              <span style={{ fontSize: '11px', color: balanced ? 'var(--muted)' : 'var(--danger)' }}>
                {remainder < 0
                  ? `Over by ${Math.abs(remainder).toFixed(2)}`
                  : blankIdxs.length > 1
                    ? `${remainder.toFixed(2)} of ${total.toFixed(2)} unallocated`
                    : `${remainder.toFixed(2)} left of ${total.toFixed(2)}`}
              </span>
            </div>
          </div>
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
