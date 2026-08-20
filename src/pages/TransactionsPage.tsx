import { Suspense } from 'react'
import { getTransactions, getBillingPeriods, getAccounts, getCategories, getPaymentMethodStyles } from '../lib/finance'
import { TransactionsClient } from '../components/transactions/TransactionsClient'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { month, from, to } = await searchParams

  const [transactions, billingPeriods, accounts, allCategories, paymentStyles] = await Promise.all([
    getTransactions(),          // always load all — client-side filtering handles the rest
    getBillingPeriods(),
    getAccounts(),
    getCategories(),
    getPaymentMethodStyles(),
  ])

  const hasMonth = typeof month === 'string' && month.length > 0
  const hasDates = (typeof from === 'string' && from.length > 0) || (typeof to === 'string' && to.length > 0)
  // Whether the URL explicitly set the When-filter — the client honours this over
  // any persisted session filter (e.g. arriving from the dashboard or a card link).
  const whenFromUrl = hasMonth || hasDates

  const dateFrom = typeof from === 'string' ? from : undefined
  const dateTo   = typeof to   === 'string' ? to   : undefined

  // Billing-period mode when ?month= is present, or — the default — when no When
  // params are given at all, so the list opens on the same billing period the
  // dashboard shows rather than an ad-hoc date range.
  let initialPeriodId: number | null = null
  if (hasMonth) {
    initialPeriodId = billingPeriods.find(p => p.start_month.startsWith(month as string))?.id ?? null
  } else if (!hasDates) {
    // Most recent period that has already started (periods are ordered newest-first),
    // falling back to the earliest if none have started yet — mirrors the dashboard.
    const todayMonth = new Date().toISOString().slice(0, 7)
    const current = billingPeriods.find(p => p.start_month.slice(0, 7) <= todayMonth)
      ?? billingPeriods[billingPeriods.length - 1]
    initialPeriodId = current?.id ?? null
  }

  return (
    <Suspense>
      <TransactionsClient
        transactions={transactions}
        billingPeriods={billingPeriods}
        initialPeriodId={initialPeriodId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialWhenFromUrl={whenFromUrl}
        accounts={accounts}
        allCategories={allCategories}
        paymentStyles={paymentStyles}
      />
    </Suspense>
  )
}
