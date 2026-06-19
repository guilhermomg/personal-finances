import { createFinancesAdminClient } from './supabase/admin'
import { getOrCreatePeriod } from './billing'
import type { Transaction, DashboardData, CardData, PaymentStyleMap, BillingPeriod, BillingPeriodOption, CumulativePoint, PaymentMethodConfig } from '../types/finance'

// ── helpers ───────────────────────────────────────────────────────────────────

function txSign(type: string): 1 | -1 {
  return type === 'expense' ? 1 : -1
}

function formatCloseDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── billing periods ───────────────────────────────────────────────────────────

async function resolveCurrentPeriod(month?: string): Promise<BillingPeriod> {
  if (month) return getOrCreatePeriod(month) as Promise<BillingPeriod>

  // Find the most recent period that has already started, then run it through
  // getOrCreatePeriod so any missing cycles/recurring transactions are seeded.
  const db = createFinancesAdminClient()
  const todayMonth = `${new Date().toISOString().slice(0, 7)}-01`
  const { data } = await db
    .from('billing_periods')
    .select('start_month')
    .lte('start_month', todayMonth)
    .order('start_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) return getOrCreatePeriod(data.start_month.slice(0, 7)) as Promise<BillingPeriod>

  // Fallback: no period has started yet — use the earliest available.
  const { data: earliest } = await db
    .from('billing_periods')
    .select('start_month')
    .order('start_month', { ascending: true })
    .limit(1)
    .maybeSingle()

  return getOrCreatePeriod((earliest as { start_month: string }).start_month.slice(0, 7)) as Promise<BillingPeriod>
}

// ── transactions list ─────────────────────────────────────────────────────────

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const db = createFinancesAdminClient()

  if (month) {
    const period = await resolveCurrentPeriod(month)
    if (!period) return []

    const { data: cycles } = await db
      .from('billing_cycles')
      .select('id')
      .eq('billing_period_id', period.id)

    const cycleIds = (cycles ?? []).map((c: any) => c.id)
    if (cycleIds.length === 0) return []

    const { data, error } = await db
      .from('transactions')
      .select('*')
      .in('billing_cycle_id', cycleIds)
      .order('date', { ascending: false })

    if (error || !data) return []
    return data as Transaction[]
  }

  const { data, error } = await db
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  if (error || !data) return []
  return data as Transaction[]
}

// ── dashboard summary ─────────────────────────────────────────────────────────

export async function getDashboardData(month?: string): Promise<DashboardData | null> {
  const db = createFinancesAdminClient()

  const currentPeriod = await resolveCurrentPeriod(month)
  if (!currentPeriod) return null

  // Billing cycles for this period, joined with their card config
  const { data: cyclesData, error: cyclesError } = await db
    .from('billing_cycles')
    .select('id, start_date, end_date, due_date, status, config:billing_cycle_configs(id, name, payment_method, credit_limit, account_type)')
    .eq('billing_period_id', currentPeriod.id)

  if (cyclesError || !cyclesData || cyclesData.length === 0) return null

  // Budgets, recurring templates, transactions, and payments in parallel
  const cycleIds = cyclesData.map((c: any) => c.id)
  const [budgetsRes, templatesRes, txsRes, paymentsRes] = await Promise.all([
    db.from('budgets').select('category, amount').eq('billing_period_id', currentPeriod.id),
    db.from('recurring_transactions').select('*'),
    db.from('transactions').select('*').in('billing_cycle_id', cycleIds).order('date', { ascending: false }),
    db.from('billing_cycle_payments').select('billing_cycle_id, amount').in('billing_cycle_id', cycleIds),
  ])

  const txs = (txsRes.data ?? []) as Transaction[]
  const budgetRows = budgetsRes.data ?? []

  // Build payments map: cycleId → total amount paid
  const paymentsById = ((paymentsRes.data ?? []) as { billing_cycle_id: number; amount: number }[])
    .reduce<Record<number, number>>((acc, p) => {
      acc[p.billing_cycle_id] = (acc[p.billing_cycle_id] ?? 0) + Number(p.amount)
      return acc
    }, {})

  // Build budget maps — fall back to env var for total when no DB row exists yet
  const categoryBudgets: Record<string, number> = Object.fromEntries(
    budgetRows.filter((b: any) => b.category !== null).map((b: any) => [b.category, Number(b.amount)])
  )
  const totalBudgetRow = budgetRows.find((b: any) => b.category === null)
  const groceriesCeiling = categoryBudgets['Groceries'] ?? 0

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // ── groceries spending ────────────────────────────────────────────────────
  const periodStarted = currentPeriod.start_month.slice(0, 7) <= todayStr.slice(0, 7)
  const groceriesSpent = txs
    .filter(t => t.category === 'Groceries' && (periodStarted ? t.date <= todayStr : true))
    .reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
  // Projected groceries — all grocery txs in the period regardless of date.
  const groceriesProjected = txs
    .filter(t => t.category === 'Groceries')
    .reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)

  // ── cards ─────────────────────────────────────────────────────────────────
  const cards: CardData[] = cyclesData.map((cycle: any) => {
    const { id: configId, payment_method, credit_limit, account_type } = cycle.config
    const cycleTxs = txs.filter(t => t.billing_cycle_id === cycle.id)
    const projected = cycleTxs.reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
    const spent = cycleTxs.filter(t => t.date <= todayStr).reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
    return {
      name: payment_method,
      spent,
      projected,
      closeDate: formatCloseDate(cycle.end_date),
      configId,
      cycleId: cycle.id as number,
      totalPaid: paymentsById[cycle.id] ?? 0,
      creditLimit: credit_limit != null ? Number(credit_limit) : null,
      accountType: account_type as 'credit_card' | 'bank_account',
      cycleStartDate: cycle.start_date as string,
      cycleEndDate: cycle.end_date as string,
    }
  })

  // ── recurring (from templates — shows what's expected, not just charged) ──
  // Use the actual transaction date for the current period if it exists; otherwise
  // derive the expected date by placing the template's day-of-month into the current period month.
  const [periodYear, periodMon] = currentPeriod.start_month.slice(0, 7).split('-')
  // Filter templates to only those relevant to the current period month.
  // Monthly: always included. Annual (and others): only when start_date's month matches.
  const periodYearMon = `${periodYear}-${periodMon}`
  const templates = (templatesRes.data ?? []).filter((rt: { frequency: string; start_date: string; deactivated_at: string | null }) => {
    if (rt.deactivated_at && rt.deactivated_at.slice(0, 7) <= periodYearMon) return false
    if (rt.start_date.slice(0, 7) > periodYearMon) return false
    if (rt.frequency === 'monthly') return true
    return rt.start_date.slice(5, 7) === periodMon
  })
  const recurring = templates.map((rt: any) => {
    const actualTx = txs.find(t => t.recurring_transaction_id === rt.id)
    const templateDay = rt.day_of_month
      ? String(rt.day_of_month).padStart(2, '0')
      : (rt.start_date as string).slice(8, 10)
    const date = actualTx?.date ?? `${periodYear}-${periodMon}-${templateDay}`
    return {
      description: rt.description,
      payment_method: rt.payment_method ?? '',
      payment_provider: null,
      amount: Number(rt.amount),
      date,
      category: rt.category as string,
      recurring_transaction_id: rt.id as number,
      actual_transaction_id: actualTx?.id ?? null,
      day_of_month: rt.day_of_month ?? null,
    }
  })
  recurring.sort((a, b) => a.date.localeCompare(b.date))
  const recurringTotal = recurring.reduce((s, r) => s + r.amount, 0)

  // ── installments ──────────────────────────────────────────────────────────
  const installmentTxs = txs
    .filter(t => t.installment_number !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const installments = installmentTxs.map(t => ({
    description: `${t.description} (${t.installment_number}/${t.installment_total})`,
    payment_method: t.payment_method,
    payment_provider: t.payment_provider ?? null,
    amount: Number(t.amount),
    date: t.date,
    notes: t.notes ?? null,
  }))
  const installTotal = installments.reduce((s, r) => s + r.amount, 0)

  // ── categories ────────────────────────────────────────────────────────────
  const categoryMap = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + txSign(t.transaction_type) * Number(t.amount)
    return acc
  }, {})
  const categories = Object.entries(categoryMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  // ── credit utilization ────────────────────────────────────────────────────
  const creditCards = cards.filter(c => c.accountType === 'credit_card' && c.creditLimit != null)
  const totalCreditLimit = creditCards.length > 0
    ? creditCards.reduce((s, c) => s + c.creditLimit!, 0)
    : null
  const totalCreditProjected = creditCards.reduce((s, c) => s + c.projected, 0)

  // ── totals ────────────────────────────────────────────────────────────────
  const totalSpent = cards.reduce((s, c) => s + c.spent, 0)
  const projectedSpent = cards.reduce((s, c) => s + c.projected, 0)
  const totalCeiling = totalBudgetRow ? Number(totalBudgetRow.amount) : 999999999
  const discretionaryCeiling = totalCeiling - recurringTotal
  // Discretionary = spending minus recurring items (use all transactions for future periods)
  const recurringActualTotal = txs
    .filter(t => t.recurring_transaction_id !== null && (periodStarted ? t.date <= todayStr : true))
    .reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
  const discretionarySpent = totalSpent - recurringActualTotal
  // Projected discretionary — full-period spend (incl. scheduled recurring still to post)
  // minus all recurring, so it reflects what will actually be left at period end.
  const recurringProjectedTotal = txs
    .filter(t => t.recurring_transaction_id !== null)
    .reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
  const discretionaryProjected = projectedSpent - recurringProjectedTotal

  // ── cumulative chart data ─────────────────────────────────────────────────
  const periodStart = cyclesData.reduce(
    (min: string, c: any) => (c.start_date < min ? c.start_date : min),
    cyclesData[0].start_date,
  )
  const periodEnd = cyclesData.reduce(
    (max: string, c: any) => (c.end_date > max ? c.end_date : max),
    cyclesData[0].end_date,
  )
  const chartEnd = todayStr < periodEnd ? todayStr : periodEnd

  const chartDays: string[] = []
  const cursor = new Date(periodStart + 'T00:00:00')
  const stop = new Date(chartEnd + 'T00:00:00')
  while (cursor <= stop) {
    chartDays.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }

  let actualAcc = 0, recurringAcc = 0, installmentAcc = 0
  const chartData: CumulativePoint[] = chartDays.map(day => {
    const dayTxs = txs.filter(t => t.date === day)
    actualAcc      += dayTxs.reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
    recurringAcc   += dayTxs.filter(t => t.recurring_transaction_id !== null).reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
    installmentAcc += dayTxs.filter(t => t.installment_number !== null).reduce((s, t) => s + txSign(t.transaction_type) * Number(t.amount), 0)
    return { date: day, actual: actualAcc, recurring: recurringAcc, installments: installmentAcc }
  })

  return {
    today: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    totalSpent,
    projectedSpent,
    totalCeiling,
    discretionarySpent,
    discretionaryProjected,
    discretionaryCeiling,
    groceriesSpent,
    groceriesProjected,
    groceriesCeiling,
    categoryBudgets,
    cards,
    recurring,
    recurringTotal,
    installments,
    installTotal,
    categories,
    currentPeriod,
    chartData,
    totalCreditLimit,
    totalCreditProjected,
  }
}

export async function getCategories(): Promise<string[]> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('categories')
    .select('name')
    .eq('active', true)
    .order('name')
  return (data ?? []).map((c: any) => c.name)
}

export async function getPaymentMethodConfigs(): Promise<PaymentMethodConfig[]> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('billing_cycle_configs')
    .select('payment_method, cycle_start_day, account_type, credit_limit')
    .eq('active', true)
  return (data ?? []) as PaymentMethodConfig[]
}

// Returns the date range (min start_date, max end_date) across all billing cycles
// for the given period (or the current period if month is omitted).
// Used to pre-set the default date filter on /transactions.
export async function getCurrentPeriodRange(month?: string): Promise<{ dateFrom: string; dateTo: string } | null> {
  const db = createFinancesAdminClient()

  let data: BillingPeriod | null = null

  if (month) {
    const startMonth = `${month}-01`
    const { data: found } = await db
      .from('billing_periods')
      .select('id, status, start_month')
      .eq('start_month', startMonth)
      .maybeSingle()
    data = found as BillingPeriod | null
  } else {
    const todayMonth = `${new Date().toISOString().slice(0, 7)}-01`
    let { data: found } = await db
      .from('billing_periods')
      .select('id, status, start_month')
      .lte('start_month', todayMonth)
      .order('start_month', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!found) {
      // Fallback: no period has started yet — use earliest available.
      const { data: earliest } = await db
        .from('billing_periods')
        .select('id, status, start_month')
        .order('start_month', { ascending: true })
        .limit(1)
        .maybeSingle()
      found = earliest
    }
    data = found as BillingPeriod | null
  }

  if (!data) return null

  const { data: cycles } = await db
    .from('billing_cycles')
    .select('start_date, end_date')
    .eq('billing_period_id', data.id)

  if (!cycles || cycles.length === 0) return null

  const startDates = (cycles as any[]).map(c => c.start_date as string).sort()
  const endDates = (cycles as any[]).map(c => c.end_date as string).sort()

  return { dateFrom: startDates[0], dateTo: endDates[endDates.length - 1] }
}

export async function getProviders(): Promise<string[]> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('transactions')
    .select('payment_provider')
    .not('payment_provider', 'is', null)
  const providers = [...new Set((data ?? []).map((r: any) => r.payment_provider as string))].sort()
  return providers
}

// Chip styling for payment methods / providers, keyed by name. Loaded server-side
// and passed to the components that render chips.
export async function getPaymentMethodStyles(): Promise<PaymentStyleMap> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('payment_method_styles')
    .select('name, label, color_main, color_secondary')
  const map: PaymentStyleMap = {}
  for (const r of (data ?? []) as any[]) {
    map[r.name] = { label: r.label, colorMain: r.color_main, colorSecondary: r.color_secondary }
  }
  return map
}

export async function getBillingPeriods(): Promise<BillingPeriodOption[]> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('billing_periods')
    .select('id, name, start_month, end_month, status, billing_cycles(id)')
    .order('start_month', { ascending: false })

  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    start_month: p.start_month,
    end_month: p.end_month,
    status: p.status as 'open' | 'closed',
    cycleIds: (p.billing_cycles ?? []).map((c: any) => c.id as number),
  }))
}
