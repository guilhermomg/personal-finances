// Every kind of row the transactions table holds. `expense`, `refund` and
// `cashback` are spending activity; `income` (money arriving from outside) and
// `transfer` (money moving between the user's own accounts) are not — see
// isSpend() in lib/finance.ts.
// Categories are partitioned by kind: expense categories drive budgets and the
// spending breakdown; income categories (Salary, Interest, Gift…) exist only to
// classify money arriving, and must never appear in an expense or budget picker.
export type CategoryKind = 'expense' | 'income'

export type TransactionType = 'expense' | 'refund' | 'cashback' | 'income' | 'transfer'

export type Transaction = {
  id: number
  date: string
  description: string
  category: string
  amount: number
  payment_method: string
  payment_provider: string | null
  statement_date: string | null
  transaction_id: string
  recurring: boolean
  created_at: string
  billing_cycle_id: number | null
  recurring_transaction_id: number | null
  goal_id: number | null
  installment_number: number | null
  installment_total: number | null
  notes: string | null
  transaction_type: TransactionType
  refund_for_transaction_id: number | null
  // Per-category splits. Present only when a transaction has 2+ categories;
  // single-category transactions rely on `category` + `amount` instead.
  allocations?: TransactionAllocation[]
}

// A single category split of a transaction. Amounts are stored positive and,
// across a transaction's allocations, sum to that transaction's `amount`.
export type TransactionAllocation = {
  category: string
  amount: number
}

// One day of activity on a bank account. Sparse: dates with no transactions
// have no row, and their balance is the previous row's closing_balance.
export type AccountBalance = {
  account_id: number
  date: string            // YYYY-MM-DD
  opening_balance: number
  inflow: number          // income, refunds, cashback — stored positive
  outflow: number         // expenses, transfers out — stored positive
  closing_balance: number
}

// Where a balance series starts, or is re-anchored to the real bank figure.
export type BalanceAnchor = {
  id: number
  account_id: number
  as_of_date: string
  balance: number
  note: string | null
}

export type ChipStyle = {
  label: string | null
  colorMain: string
  colorSecondary: string | null
}

export type PaymentStyleMap = Record<string, ChipStyle>

export type BillingCyclePayment = {
  id: number
  billing_cycle_id: number
  amount: number
  payment_date: string
  notes: string | null
  created_at: string
}

export type CardData = {
  name: string
  spent: number
  projected: number
  closeDate: string
  accountId: number
  cycleId: number         // billing_cycles.id for this card's current cycle
  totalPaid: number       // sum of all billing_cycle_payments for this cycle
  creditLimit: number | null
  accountType: 'credit_card' | 'bank_account'
  cycleStartDate: string  // YYYY-MM-DD — actual billing cycle start
  cycleEndDate: string    // YYYY-MM-DD — actual billing cycle end
}

export type TransactionRow = {
  description: string
  payment_method: string
  payment_provider: string | null
  amount: number
  date: string
  notes?: string | null
  // Populated for recurring template rows
  category?: string
  recurring_transaction_id?: number | null
  actual_transaction_id?: number | null
  day_of_month?: number | null
  transaction_type?: TransactionType
}

export type CategoryData = {
  name: string
  amount: number
}

export type CumulativePoint = {
  date: string   // YYYY-MM-DD
  actual: number
  recurring: number
  installments: number
}

export type Account = {
  id: number
  payment_method: string
  cycle_start_day: number
  account_type: 'credit_card' | 'bank_account'
  credit_limit: number | null
  // Cached by rebuildAccountBalances(); null until an account has an anchor.
  // `current` is as of today, `projected` includes future-dated rows.
  current_balance: number | null
  current_balance_date: string | null
  projected_balance: number | null
}

export type BillingPeriod = {
  id: number
  name: string
  start_month: string
  end_month: string | null
  status: 'open' | 'closed'
}

export type BillingPeriodOption = BillingPeriod & { cycleIds: number[] }

export type DashboardData = {
  today: string
  totalSpent: number
  projectedSpent: number
  totalCeiling: number
  discretionarySpent: number
  discretionaryProjected: number
  discretionaryCeiling: number
  groceriesSpent: number
  groceriesProjected: number
  groceriesCeiling: number
  budgetCards: { category: string; ceiling: number; spent: number; projected: number }[]
  categoryBudgets: Record<string, number>
  cards: CardData[]
  recurring: TransactionRow[]
  recurringTotal: number
  // Income landing in this period (seeded from a recurring template, or entered
  // by hand). Excluded from every spend figure — see isSpend in lib/finance.
  income: TransactionRow[]
  incomeTotal: number
  installments: TransactionRow[]
  installTotal: number
  categories: CategoryData[]
  currentPeriod: BillingPeriod
  chartData: CumulativePoint[]
  totalCreditLimit: number | null
  totalCreditProjected: number
}
