'use server'

import { createFinancesAdminClient, ownerUserId } from './supabase/admin'
import { getOrCreateCycleForTransaction, getOrCreateCycleByStatementDate, getOrCreatePeriod } from './billing'
import { rebuildAllAccountBalances, setBalanceAnchor } from './balances'
import type { CategoryKind, TransactionAllocation, TransactionType } from '../types/finance'

type TransactionData = {
  description: string
  date: string
  category: string
  payment_method: string
  amount: number
  notes: string | null
  statement_date: string | null
  transaction_type?: TransactionType
  refund_for_transaction_id?: number | null
  // Per-category splits. Length ≤ 1 → single-category (no allocation rows stored).
  categories?: TransactionAllocation[]
}

// The category stored on the transaction row itself — the primary (largest)
// split when a transaction is split, otherwise the single chosen category.
function primaryCategory(categories: TransactionAllocation[] | undefined, fallback: string): string {
  if (!categories || categories.length === 0) return fallback
  return categories.reduce((max, a) => (a.amount > max.amount ? a : max), categories[0]).category
}

// Replaces a transaction's category splits. Stores rows only when there are 2+
// categories; a single category relies on transactions.category/amount instead.
async function reconcileAllocations(
  db: ReturnType<typeof createFinancesAdminClient>,
  transactionId: number,
  categories: TransactionAllocation[] | undefined,
) {
  const { error: delError } = await db
    .from('transaction_categories')
    .delete()
    .eq('transaction_id', transactionId)
  if (delError) throw new Error(delError.message)

  if (!categories || categories.length < 2) return

  const rows = categories.map(a => ({
    transaction_id: transactionId,
    category: a.category,
    amount: a.amount,
    user_id: ownerUserId(),
  }))
  const { error: insError } = await db.from('transaction_categories').insert(rows)
  if (insError) throw new Error(insError.message)
}

export async function addTransaction(data: TransactionData) {
  const db = createFinancesAdminClient()
  const { categories, ...txData } = data
  const billing_cycle_id = data.statement_date
    ? await getOrCreateCycleByStatementDate(data.statement_date, data.payment_method)
    : await getOrCreateCycleForTransaction(data.date, data.payment_method)
  const transaction_id = crypto.randomUUID()
  const { data: inserted, error } = await db
    .from('transactions')
    .insert({ ...txData, category: primaryCategory(categories, txData.category), billing_cycle_id, transaction_id, user_id: ownerUserId() })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await reconcileAllocations(db, (inserted as { id: number }).id, categories)
  await rebuildAllAccountBalances()
}

export async function upsertBudget(billingPeriodId: number, category: string | null, amount: number) {
  const db = createFinancesAdminClient()
  let q = db.from('budgets').select('id').eq('billing_period_id', billingPeriodId)
  q = category === null ? (q as any).is('category', null) : (q as any).eq('category', category)
  const { data: existing } = await (q as any).maybeSingle()
  if (existing) {
    const { error } = await db.from('budgets').update({ amount }).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('budgets').insert({ billing_period_id: billingPeriodId, category, amount, user_id: ownerUserId() })
    if (error) throw new Error(error.message)
  }
}

// Sets a category budget for the given period and every period from that month
// onward, so the budget carries across all future periods. (Periods created
// later inherit it via the carry-forward in getOrCreatePeriod.)
export async function upsertBudgetForward(fromPeriodId: number, category: string, amount: number) {
  const db = createFinancesAdminClient()

  const { data: from } = await db
    .from('billing_periods')
    .select('start_month')
    .eq('id', fromPeriodId)
    .maybeSingle()
  if (!from) throw new Error('Billing period not found')

  const { data: periods } = await db
    .from('billing_periods')
    .select('id')
    .gte('start_month', (from as { start_month: string }).start_month)
  const periodIds = (periods ?? []).map((p: any) => p.id as number)
  if (periodIds.length === 0) return

  const { data: existing } = await db
    .from('budgets')
    .select('id, billing_period_id')
    .eq('category', category)
    .in('billing_period_id', periodIds)
  const existingRows = (existing ?? []) as { id: number; billing_period_id: number }[]
  const haveBudget = new Set(existingRows.map(r => r.billing_period_id))

  for (const row of existingRows) {
    const { error } = await db.from('budgets').update({ amount }).eq('id', row.id)
    if (error) throw new Error(error.message)
  }

  const missing = periodIds.filter(id => !haveBudget.has(id))
  if (missing.length > 0) {
    const { error } = await db.from('budgets').insert(
      missing.map(id => ({ billing_period_id: id, category, amount, user_id: ownerUserId() })),
    )
    if (error) throw new Error(error.message)
  }
}

type NewAccountData = {
  name: string
  accountType: 'credit_card' | 'bank_account'
  // Day of the month the cycle opens. Constrained to 2-28 by the form: the
  // cycle's end day is derived as cycleStartDay - 1 in the *following* month, so
  // day 1 would need a day-0 end, and days 29-31 would produce invalid dates in
  // short months.
  cycleStartDay: number
  paymentDueDay: number | null
  creditLimit: number | null
  fundingAccountId: number | null
  // Bank accounts only — where balance tracking starts.
  initialBalance: number | null
  initialBalanceDate: string | null
}

// Creates an account and, for a bank account, its first balance anchor. The
// anchor is what switches balance tracking on: without one, rebuilds skip the
// account entirely.
export async function addAccount(data: NewAccountData): Promise<{ id: number }> {
  const db = createFinancesAdminClient()

  // cycle_end_day is start - 1 in the following month, so day 1 would need a
  // day-0 end and days 29-31 do not exist in every month.
  if (data.cycleStartDay < 2 || data.cycleStartDay > 28) {
    throw new Error('Cycle start day must be between 2 and 28')
  }

  const { data: inserted, error } = await db
    .from('accounts')
    .insert({
      name: data.name,
      payment_method: data.name,
      account_type: data.accountType,
      cycle_start_day: data.cycleStartDay,
      cycle_end_day: data.cycleStartDay - 1,
      payment_due_day: data.accountType === 'credit_card' ? data.paymentDueDay : null,
      credit_limit: data.accountType === 'credit_card' ? data.creditLimit : null,
      funding_account_id: data.accountType === 'credit_card' ? data.fundingAccountId : null,
      active: true,
      user_id: ownerUserId(),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`An account named "${data.name}" already exists`)
    throw new Error(error.message)
  }
  const accountId = (inserted as { id: number }).id

  if (data.initialBalanceDate && data.initialBalanceDate > new Date().toISOString().slice(0, 10)) {
    throw new Error('Starting balance date cannot be in the future')
  }

  if (data.accountType === 'bank_account' && data.initialBalance !== null && data.initialBalanceDate) {
    await setBalanceAnchor(accountId, data.initialBalanceDate, data.initialBalance, 'Initial balance')
  }

  // Give the new account a cycle in the current period so it appears right away;
  // other periods get theirs as they are visited.
  await getOrCreatePeriod(new Date().toISOString().slice(0, 7))

  return { id: accountId }
}

// Re-anchor an account to its real bank balance. Real accounts drift — fees,
// interest, transactions never recorded — and without this the error compounds
// forever. A later anchor supersedes earlier ones without rewriting history.
export async function reconcileAccountBalance(
  accountId: number,
  asOfDate: string,
  balance: number,
  note: string | null = null,
) {
  // Reconciliation means "this is what the bank says right now", so a future
  // date is always a mistake — and one that would otherwise sit inert until it
  // arrived, then silently rewrite the balance.
  if (asOfDate > new Date().toISOString().slice(0, 10)) {
    throw new Error('Balance date cannot be in the future')
  }
  await setBalanceAnchor(accountId, asOfDate, balance, note ?? 'Reconciled')
}

export async function updateCreditLimit(accountId: number, amount: number | null) {
  const db = createFinancesAdminClient()
  const { error } = await db
    .from('accounts')
    .update({ credit_limit: amount })
    .eq('id', accountId)
  if (error) throw new Error(error.message)
}

export async function addCategory(name: string, kind: CategoryKind = 'expense') {
  const db = createFinancesAdminClient()
  const { error } = await db.from('categories').insert({ name, kind, user_id: ownerUserId() })
  // Ignore unique-constraint errors — category may already exist
  if (error && !error.code.includes('23505')) throw new Error(error.message)
}

type InstallmentTransactionData = {
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

export async function addInstallments(items: InstallmentTransactionData[]) {
  const db = createFinancesAdminClient()
  const rows = []
  for (const item of items) {
    const billing_cycle_id = await getOrCreateCycleForTransaction(item.date, item.payment_method)
    rows.push({ ...item, billing_cycle_id, transaction_id: crypto.randomUUID(), statement_date: null, user_id: ownerUserId() })
  }
  const { error } = await db.from('transactions').insert(rows)
  if (error) throw new Error(error.message)
  await rebuildAllAccountBalances()
}

type RecurringUpdateData = {
  description: string
  category: string
  amount: number
  payment_method: string
  day_of_month: number | null
}

export async function deactivateRecurringTransaction(id: number) {
  const db = createFinancesAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const { error } = await db
    .from('recurring_transactions')
    .update({ active: false, deactivated_at: today })
    .eq('id', id)
  if (error) throw new Error(error.message)
  const { error: txError } = await db
    .from('transactions')
    .delete()
    .eq('recurring_transaction_id', id)
    .gte('date', today)
  if (txError) throw new Error(txError.message)
  await rebuildAllAccountBalances()
}

export async function updateRecurringTransaction(id: number, data: RecurringUpdateData) {
  const db = createFinancesAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch the old template to carry over fields not exposed in the edit form
  const { data: old, error: fetchError } = await db
    .from('recurring_transactions')
    .select('frequency, account_id')
    .eq('id', id)
    .single()
  if (fetchError || !old) throw new Error(fetchError?.message ?? 'Recurring transaction not found')

  // Deactivate old template and delete all its future uncommitted transaction stubs
  const { error: deactivateError } = await db
    .from('recurring_transactions')
    .update({ active: false, deactivated_at: today })
    .eq('id', id)
  if (deactivateError) throw new Error(deactivateError.message)

  const { error: deleteError } = await db
    .from('transactions')
    .delete()
    .eq('recurring_transaction_id', id)
    .gte('date', today)
  if (deleteError) throw new Error(deleteError.message)

  // Clone as a new active template — seeding will re-create future stubs on next page load
  const { error: insertError } = await db.from('recurring_transactions').insert({
    description: data.description,
    category: data.category,
    amount: data.amount,
    payment_method: data.payment_method,
    day_of_month: data.day_of_month,
    frequency: (old as any).frequency,
    start_date: today,
    active: true,
    account_id: (old as any).account_id,
    user_id: ownerUserId(),
  })
  if (insertError) throw new Error(insertError.message)
  await rebuildAllAccountBalances()
}

// `fundingAccountId` is where the money left from. Defaults to the card's
// configured funding account, so recording a payment the usual way needs no
// extra input — and once recorded, the balance series uses the real date and
// amount instead of the due-date projection.
export async function addBillingCyclePayment(
  cycleId: number,
  amount: number,
  paymentDate: string,
  notes: string | null,
  fundingAccountId?: number | null,
) {
  const db = createFinancesAdminClient()

  let funding = fundingAccountId ?? null
  if (funding === null) {
    const { data } = await db
      .from('billing_cycles')
      .select('account:accounts!billing_cycles_account_id_fkey(funding_account_id)')
      .eq('id', cycleId)
      .maybeSingle()
    funding = (data as any)?.account?.funding_account_id ?? null
  }

  const { error } = await db
    .from('billing_cycle_payments')
    .insert({
      billing_cycle_id: cycleId, amount, payment_date: paymentDate, notes,
      funding_account_id: funding, user_id: ownerUserId(),
    })
  if (error) throw new Error(error.message)
  await rebuildAllAccountBalances()
}

export async function updateTransaction(id: number, data: TransactionData) {
  const db = createFinancesAdminClient()
  const { categories, ...txData } = data
  const billing_cycle_id = data.statement_date
    ? await getOrCreateCycleByStatementDate(data.statement_date, data.payment_method)
    : await getOrCreateCycleForTransaction(data.date, data.payment_method)
  const { error } = await db
    .from('transactions')
    .update({ ...txData, category: primaryCategory(categories, txData.category), billing_cycle_id })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await reconcileAllocations(db, id, categories)
  await rebuildAllAccountBalances()
}

export async function deleteTransaction(id: number) {
  const db = createFinancesAdminClient()
  const { error } = await db
    .from('transactions')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  await rebuildAllAccountBalances()
}
