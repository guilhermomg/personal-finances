'use server'

import { createFinancesAdminClient, ownerUserId } from './supabase/admin'
import { getOrCreateCycleForTransaction, getOrCreateCycleByStatementDate } from './billing'

type TransactionData = {
  description: string
  date: string
  category: string
  payment_method: string
  amount: number
  notes: string | null
  statement_date: string | null
  transaction_type?: 'expense' | 'refund' | 'cashback'
  refund_for_transaction_id?: number | null
}

export async function addTransaction(data: TransactionData) {
  const db = createFinancesAdminClient()
  const billing_cycle_id = data.statement_date
    ? await getOrCreateCycleByStatementDate(data.statement_date, data.payment_method)
    : await getOrCreateCycleForTransaction(data.date, data.payment_method)
  const transaction_id = crypto.randomUUID()
  const { error } = await db.from('transactions').insert({ ...data, billing_cycle_id, transaction_id, user_id: ownerUserId() })
  if (error) throw new Error(error.message)
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

export async function updateCreditLimit(configId: number, amount: number | null) {
  const db = createFinancesAdminClient()
  const { error } = await db
    .from('billing_cycle_configs')
    .update({ credit_limit: amount })
    .eq('id', configId)
  if (error) throw new Error(error.message)
}

export async function addCategory(name: string) {
  const db = createFinancesAdminClient()
  const { error } = await db.from('categories').insert({ name, user_id: ownerUserId() })
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
}

export async function updateRecurringTransaction(id: number, data: RecurringUpdateData) {
  const db = createFinancesAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch the old template to carry over fields not exposed in the edit form
  const { data: old, error: fetchError } = await db
    .from('recurring_transactions')
    .select('frequency, config_id')
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
    config_id: (old as any).config_id,
    user_id: ownerUserId(),
  })
  if (insertError) throw new Error(insertError.message)
}

export async function addBillingCyclePayment(
  cycleId: number,
  amount: number,
  paymentDate: string,
  notes: string | null,
) {
  const db = createFinancesAdminClient()
  const { error } = await db
    .from('billing_cycle_payments')
    .insert({ billing_cycle_id: cycleId, amount, payment_date: paymentDate, notes, user_id: ownerUserId() })
  if (error) throw new Error(error.message)
}

export async function updateTransaction(id: number, data: TransactionData) {
  const db = createFinancesAdminClient()
  const billing_cycle_id = data.statement_date
    ? await getOrCreateCycleByStatementDate(data.statement_date, data.payment_method)
    : await getOrCreateCycleForTransaction(data.date, data.payment_method)
  const { error } = await db
    .from('transactions')
    .update({ ...data, billing_cycle_id })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
