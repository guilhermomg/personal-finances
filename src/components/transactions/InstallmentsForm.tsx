'use client'

import { useEffect, useImperativeHandle, useState } from 'react'
import type { Account } from '../../types/finance'
import { inputStyle, labelStyle } from './transaction-utils'
import { AmountInput } from './AmountInput'

export type InstallmentItem = {
  description: string
  date: string
  category: string
  payment_method: string
  payment_provider: string | null
  amount: number
  notes: string | null
  installment_number: number
  installment_total: number
}

export type InstallmentsFormHandle = {
  getValues(): { items: InstallmentItem[]; newCategoryToAdd: string | null } | null
}

type Periodicity = 'weekly' | 'biweekly' | 'monthly'
type ScheduleRow = { date: string; amount: string }

function computeSchedule(
  firstDate: string,
  n: number,
  periodicity: Periodicity,
  totalAmount: number
): ScheduleRow[] {
  if (!Number.isFinite(n) || n < 1 || !isFinite(totalAmount) || totalAmount <= 0 || !firstDate) return []

  const base = Math.floor((totalAmount / n) * 100) / 100
  const amounts: number[] = Array(n).fill(base)
  const remainder = Math.round((totalAmount - base * n) * 100) / 100
  amounts[n - 1] = Math.round((amounts[n - 1] + remainder) * 100) / 100

  const dates: string[] = [firstDate]
  for (let i = 1; i < n; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00')
    if (periodicity === 'weekly') prev.setDate(prev.getDate() + 7)
    else if (periodicity === 'biweekly') prev.setDate(prev.getDate() + 14)
    else prev.setMonth(prev.getMonth() + 1)
    dates.push(prev.toISOString().split('T')[0])
  }

  return dates.map((date, i) => ({ date, amount: amounts[i].toFixed(2) }))
}

type Props = {
  ref?: React.Ref<InstallmentsFormHandle>
  allCategories: string[]
  allMethods: string[]
  allProviders: string[]
  accounts: Account[]
}

export function InstallmentsForm({ ref, allCategories, allMethods, allProviders }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    description: '',
    category: allCategories[0] ?? '',
    totalAmount: '0.00',
    payment_method: allMethods[0] ?? '',
    payment_provider: '',
    numInstallments: '3',
    periodicity: 'monthly' as Periodicity,
    firstDate: todayStr,
    notes: '',
  })
  const [newCategoryMode, setNewCategoryMode] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])

  useEffect(() => {
    const n = parseInt(form.numInstallments)
    const total = parseFloat(form.totalAmount)
    setSchedule(computeSchedule(form.firstDate, n, form.periodicity, total))
  }, [form.numInstallments, form.periodicity, form.firstDate, form.totalAmount])

  useImperativeHandle(ref, () => ({
    getValues() {
      const total = parseFloat(form.totalAmount)
      if (isNaN(total) || total <= 0) return null
      if (!form.description.trim()) return null
      const n = parseInt(form.numInstallments)
      if (isNaN(n) || n < 2) return null
      if (schedule.length === 0) return null

      const items: InstallmentItem[] = []
      for (let i = 0; i < schedule.length; i++) {
        const amount = parseFloat(schedule[i].amount)
        if (isNaN(amount) || amount < 0) return null
        items.push({
          description: form.description,
          date: schedule[i].date,
          category: form.category,
          payment_method: form.payment_method,
          payment_provider: form.payment_provider || null,
          amount,
          notes: form.notes || null,
          installment_number: i + 1,
          installment_total: n,
        })
      }

      return {
        items,
        newCategoryToAdd: newCategoryMode ? form.category : null,
      }
    },
  }), [form, schedule, newCategoryMode])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
    }
  }

  function updateRow(index: number, field: 'date' | 'amount', value: string) {
    setSchedule(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  const totalAmount = parseFloat(form.totalAmount) || 0
  const scheduleTotal = Math.round(schedule.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0) * 100) / 100
  const totalMismatch = schedule.length > 0 && Math.abs(scheduleTotal - totalAmount) > 0.01

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>Description</label>
        <input style={inputStyle} value={form.description} onChange={set('description')} placeholder="e.g. MacBook Pro" />
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <label style={labelStyle}>Payment Method</label>
          <select style={inputStyle} value={form.payment_method} onChange={set('payment_method')}>
            {allMethods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <label style={labelStyle}>Payment Provider</label>
          <select style={inputStyle} value={form.payment_provider} onChange={set('payment_provider')}>
            <option value="">— None —</option>
            {allProviders.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <label style={labelStyle}>Total Amount</label>
          <AmountInput value={form.totalAmount} onValueChange={v => setForm(prev => ({ ...prev, totalAmount: v }))} />
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <label style={labelStyle}>Installments</label>
          <input type="number" step="1" min="2" max="60" style={inputStyle} value={form.numInstallments} onChange={set('numInstallments')} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>First Date</label>
        <input type="date" style={inputStyle} value={form.firstDate} onChange={set('firstDate')} />
      </div>

      <div>
        <label style={labelStyle}>Frequency</label>
        <select
          style={inputStyle}
          value={form.periodicity}
          onChange={e => setForm(prev => ({ ...prev, periodicity: e.target.value as Periodicity }))}
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {schedule.length > 0 && (
        <div>
          <label style={labelStyle}>Schedule</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {schedule.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '5px 10px',
                    borderBottom: i < schedule.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'var(--surface2)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <input
                    type="date"
                    style={{ ...inputStyle, padding: '4px 8px' }}
                    value={row.date}
                    onChange={e => updateRow(i, 'date', e.target.value)}
                  />
                  <AmountInput
                    style={{ ...inputStyle, padding: '4px 8px' }}
                    value={row.amount}
                    onValueChange={v => updateRow(i, 'amount', v)}
                  />
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 10px',
              background: 'var(--surface)',
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Total
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: totalMismatch ? 'var(--danger)' : 'var(--text)' }}>
                ${scheduleTotal.toFixed(2)}
                {totalMismatch && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> / ${totalAmount.toFixed(2)}</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: '56px', fontFamily: 'inherit' }}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Optional note…"
        />
      </div>
    </div>
  )
}
