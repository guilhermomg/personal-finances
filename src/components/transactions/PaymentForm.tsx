'use client'

import { useImperativeHandle, useState } from 'react'
import { inputStyle, labelStyle } from './transaction-utils'
import { AmountInput } from './AmountInput'
import type { Account } from '../../types/finance'

export type PaymentCard = { name: string; cycleId: number; fundingAccountId: number | null }

export type PaymentFormValues = {
  cycleId: number
  amount: number
  paymentDate: string
  notes: string | null
  // Which account the money left. Recording this is what lets the payment show
  // up as a real outflow on the funding account's balance, on its actual date,
  // instead of the estimate projected on the cycle's due date.
  fundingAccountId: number | null
}

export type PaymentFormHandle = {
  getValues(): PaymentFormValues | null
}

type Props = {
  ref?: React.Ref<PaymentFormHandle>
  creditCards: PaymentCard[]
  accounts: Account[]
}

export function PaymentForm({ ref, creditCards, accounts }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const initCard = creditCards[0]
  const bankAccounts = accounts.filter(a => a.account_type === 'bank_account')

  const [form, setForm] = useState({
    cycleId: initCard?.cycleId ?? 0,
    amount: '0.00',
    paymentDate: todayStr,
    notes: '',
    fundingAccountId: initCard?.fundingAccountId ?? bankAccounts[0]?.id ?? 0,
  })

  useImperativeHandle(ref, () => ({
    getValues() {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount <= 0) return null
      if (!form.cycleId) return null
      return {
        cycleId: form.cycleId,
        amount,
        paymentDate: form.paymentDate,
        notes: form.notes.trim() || null,
        fundingAccountId: form.fundingAccountId || null,
      }
    },
  }), [form])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = field === 'cycleId' || field === 'fundingAccountId'
        ? Number(e.target.value) : e.target.value
      setForm(prev => {
        const next = { ...prev, [field]: value }
        if (field === 'cycleId') {
          const card = creditCards.find(c => c.cycleId === value)
          next.fundingAccountId = card?.fundingAccountId ?? prev.fundingAccountId
        }
        return next
      })
    }
  }

  if (creditCards.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
        No credit cards configured.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div>
        <label style={labelStyle}>Card</label>
        <select
          style={inputStyle}
          value={form.cycleId}
          onChange={set('cycleId')}
        >
          {creditCards.map(c => (
            <option key={c.cycleId} value={c.cycleId}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Paid from</label>
        <select style={inputStyle} value={form.fundingAccountId} onChange={set('fundingAccountId')}>
          {bankAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.payment_method}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Amount</label>
        <AmountInput value={form.amount} onValueChange={v => setForm(prev => ({ ...prev, amount: v }))} />
      </div>

      <div>
        <label style={labelStyle}>Payment Date</label>
        <input
          type="date"
          style={inputStyle}
          value={form.paymentDate}
          onChange={set('paymentDate')}
        />
      </div>

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
