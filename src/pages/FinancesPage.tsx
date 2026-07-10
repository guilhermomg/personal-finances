import { getDashboardData, getPaymentMethodConfigs, getCategories, getProviders, getPaymentMethodStyles } from '../lib/finance'
import { SpendingCard } from '../components/SpendingCard'
import { CardSummary } from '../components/CardSummary'
import { TransactionTable } from '../components/TransactionTable'
import { RecurringTableWithEdit } from '../components/RecurringTableWithEdit'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { BillingPeriodSwitcher } from '../components/BillingPeriodSwitcher'
import { FAB } from '../components/FAB'
import { CumulativeChart } from '../components/CumulativeChart'
import { CreditUsageCard } from '../components/CreditUsageCard'
import { AddBudgetButton } from '../components/AddBudgetButton'

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { month } = await searchParams
  const [data, paymentMethodConfigs, allCategories, allProviders, paymentStyles] = await Promise.all([
    getDashboardData(month as string | undefined),
    getPaymentMethodConfigs(),
    getCategories(),
    getProviders(),
    getPaymentMethodStyles(),
  ])

  if (!data) {
    return <p style={{ color: 'var(--muted)' }}>No transactions found for the current billing cycle.</p>
  }

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <BillingPeriodSwitcher currentPeriod={data.currentPeriod} />
      </div>

      <div className="grid grid-2">
        <SpendingCard
          label="Total Expenses"
          spent={data.totalSpent}
          ceiling={data.totalCeiling}
          projected={data.projectedSpent}
          editTarget={{ billingPeriodId: data.currentPeriod.id, category: null }}
        />
        <SpendingCard
          label="Discretionary"
          spent={data.discretionarySpent}
          ceiling={data.discretionaryCeiling}
          projected={data.discretionaryProjected}
          deduction={{
            // Reserve the still-unspent headroom of every category budget, not just groceries.
            amount: data.budgetCards.reduce((s, b) => s + Math.max(0, b.ceiling - b.projected), 0),
            label: 'after budgets',
          }}
        />
      </div>

      <div className="page-section">
        <div className="page-section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          Budgets
          <AddBudgetButton
            billingPeriodId={data.currentPeriod.id}
            availableCategories={allCategories.filter(c => !(c in data.categoryBudgets))}
          />
        </div>
        <div className="grid grid-3">
          {data.budgetCards.map(b => (
            <SpendingCard
              key={b.category}
              label={b.category}
              spent={b.spent}
              ceiling={b.ceiling}
              projected={Math.abs(b.projected - b.spent) > 0.005 ? b.projected : undefined}
              editTarget={{ billingPeriodId: data.currentPeriod.id, category: b.category }}
              href={`/finances/transactions?category=${encodeURIComponent(b.category)}&month=${data.currentPeriod.start_month.slice(0, 7)}`}
            />
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="page-section-title">Cards &amp; Accounts</div>
        <div className="grid grid-3">
          {data.cards.map(card => (
            <CardSummary key={card.name} {...card} month={month as string | undefined} />
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="grid grid-2">
          {data.totalCreditLimit != null && (
            <CreditUsageCard
              totalCreditLimit={data.totalCreditLimit}
              totalCreditProjected={data.totalCreditProjected}
            />
          )}
          <CumulativeChart data={data.chartData} />
        </div>
      </div>

      <hr className="divider" />

      <div className="grid grid-2">
        <RecurringTableWithEdit
          rows={data.recurring}
          total={data.recurringTotal}
          totalSpent={data.totalCeiling}
          allCategories={allCategories}
          allMethods={data.cards.map(c => c.name)}
          paymentMethodConfigs={paymentMethodConfigs}
          paymentStyles={paymentStyles}
        />
        <TransactionTable
          title="Installments"
          dotColor="var(--accent2)"
          rows={data.installments}
          total={data.installTotal}
          totalSpent={data.totalCeiling}
          totalColor="var(--accent2)"
          paymentStyles={paymentStyles}
        />
      </div>

      <hr className="divider" />

      <CategoryBreakdown
        categories={data.categories}
        totalCeiling={data.totalCeiling}
      />

      <FAB
        allCategories={allCategories}
        allMethods={data.cards.map(c => c.name)}
        allProviders={allProviders}
        paymentMethodConfigs={paymentMethodConfigs}
        creditCards={data.cards
          .filter(c => c.accountType === 'credit_card')
          .map(c => ({ name: c.name, cycleId: c.cycleId }))}
      />
    </>
  )
}
