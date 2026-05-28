import { Suspense } from 'react'
import { getTransactions, getCurrentPeriodRange, getBillingPeriods, getPaymentMethodConfigs, getCategories } from '../lib/finance'
import { TransactionsClient } from '../components/transactions/TransactionsClient'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { month, from, to } = await searchParams

  const [transactions, billingPeriods, paymentMethodConfigs, allCategories] = await Promise.all([
    getTransactions(),          // always load all — client-side filtering handles the rest
    getBillingPeriods(),
    getPaymentMethodConfigs(),
    getCategories(),
  ])

  // If ?month= is present, pre-select that billing period (billing-period mode).
  const initialPeriodId = month
    ? (billingPeriods.find(p => p.start_month.startsWith(month as string))?.id ?? null)
    : null

  // If ?from=/?to= are present, use them as the initial date range (date-range mode).
  // If neither month nor dates, fall back to the current period's date range.
  let dateFrom = from as string | undefined
  let dateTo   = to   as string | undefined
  if (!initialPeriodId && !dateFrom && !dateTo) {
    const periodRange = await getCurrentPeriodRange()
    dateFrom = periodRange?.dateFrom
    dateTo   = periodRange?.dateTo
  }

  return (
    <Suspense>
      <TransactionsClient
        transactions={transactions}
        billingPeriods={billingPeriods}
        initialPeriodId={initialPeriodId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        paymentMethodConfigs={paymentMethodConfigs}
        allCategories={allCategories}
      />
    </Suspense>
  )
}
