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
  transaction_type: 'expense' | 'refund' | 'cashback'
  refund_for_transaction_id: number | null
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
  configId: number
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
  transaction_type?: 'expense' | 'refund' | 'cashback'
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

export type PaymentMethodConfig = {
  payment_method: string
  cycle_start_day: number
  account_type: 'credit_card' | 'bank_account'
  credit_limit: number | null
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
  discretionaryCeiling: number
  groceriesSpent: number
  groceriesCeiling: number
  categoryBudgets: Record<string, number>
  cards: CardData[]
  recurring: TransactionRow[]
  recurringTotal: number
  installments: TransactionRow[]
  installTotal: number
  categories: CategoryData[]
  currentPeriod: BillingPeriod
  chartData: CumulativePoint[]
  totalCreditLimit: number | null
  totalCreditProjected: number
}
