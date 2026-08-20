'use client'

import { useState } from 'react'
import { TransactionTable } from './TransactionTable'
import { RecurringEditModal } from './transactions/RecurringEditModal'
import type { TransactionRow, Account, PaymentStyleMap } from '../types/finance'

type Props = {
  rows: TransactionRow[]
  total: number
  totalSpent: number
  allCategories: string[]
  allMethods: string[]
  accounts: Account[]
  paymentStyles: PaymentStyleMap
}

export function RecurringTableWithEdit({ rows, total, totalSpent, allCategories, allMethods, accounts, paymentStyles }: Props) {
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null)

  return (
    <>
      <TransactionTable
        title="Recurring Transactions"
        dotColor="var(--accent)"
        rows={rows}
        total={total}
        totalSpent={totalSpent}
        paymentStyles={paymentStyles}
        onRowClick={setEditingRow}
      />
      {editingRow?.recurring_transaction_id != null && (
        <RecurringEditModal
          recurringTransactionId={editingRow.recurring_transaction_id}
          description={editingRow.description}
          category={editingRow.category ?? ''}
          amount={editingRow.amount}
          payment_method={editingRow.payment_method}
          day_of_month={editingRow.day_of_month ?? null}
          allCategories={allCategories}
          allMethods={allMethods}
          accounts={accounts}
          onClose={() => setEditingRow(null)}
        />
      )}
    </>
  )
}
