'use client'

import { useState } from 'react'
import { TransactionModal } from './transactions/TransactionModal'
import type { Account } from '../types/finance'
import type { PaymentCard } from './transactions/PaymentForm'

export function FAB({ allCategories, incomeCategories, allMethods, allProviders, accounts, creditCards = [] }: {
  allCategories: string[]
  incomeCategories: string[]
  allMethods: string[]
  allProviders: string[]
  accounts: Account[]
  creditCards?: PaymentCard[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add transaction"
        className="fab-button"
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          color: 'var(--bg)',
          fontSize: '26px',
          fontWeight: 300,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          lineHeight: 1,
        }}
      >
        +
      </button>
      {open && (
        <TransactionModal
          allCategories={allCategories}
          allMethods={allMethods}
          allProviders={allProviders}
          accounts={accounts}
          incomeCategories={incomeCategories}
          creditCards={creditCards}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
