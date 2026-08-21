import { createHash } from 'node:crypto'
import { createFinancesAdminClient, ownerUserId } from './supabase/admin'
import type { AccountBalance, BalanceAnchor, TransactionType } from '../types/finance'

// Balance maintenance lives here rather than in database triggers, so the rules
// are visible in the codebase and testable without a database round-trip.
//
// The core operation is a full rebuild of one account from its latest anchor.
// That is deliberately not an incremental delta: at this scale a rebuild is two
// statements and a few hundred rows of arithmetic, and it makes every mutation
// take the identical path. A past-dated insert, an edit that moves a transaction
// between accounts, and a delete are all just "recompute the account" — which is
// where the whole class of running-balance drift bugs disappears.

// Which side of the ledger each transaction type lands on. Amounts are stored
// positive throughout the schema; direction comes from the type alone.
const INFLOW_TYPES: readonly TransactionType[] = ['income', 'refund', 'cashback']
const OUTFLOW_TYPES: readonly TransactionType[] = ['expense', 'transfer']

type SourceRow = {
  id: number
  date: string
  amount: number | string
  transaction_type: TransactionType
}

// A fingerprint of every source row feeding an account's balances. Stored
// alongside the cached figures so the app can tell whether anything changed
// since the last rebuild — including changes made outside the app, such as the
// /personal-finance skill writing raw SQL through the Supabase MCP.
//
// Covers id, date, amount and type, so a re-dated transaction (same amount) and
// a type change (same amount and date) both register.
function digestOf(rows: SourceRow[]): string {
  const canonical = rows
    .map(r => `${r.id}:${r.date}:${Number(r.amount).toFixed(2)}:${r.transaction_type}`)
    .sort()
    .join('|')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

type DailyTotals = { date: string; inflow: number; outflow: number }

// Collapse transactions into one inflow/outflow pair per date. Exported for
// tests: this is the arithmetic worth pinning down, and it needs no database.
export function dailyTotals(rows: SourceRow[]): DailyTotals[] {
  const byDate = new Map<string, DailyTotals>()
  for (const r of rows) {
    const day = byDate.get(r.date) ?? { date: r.date, inflow: 0, outflow: 0 }
    const amount = Number(r.amount)
    if (INFLOW_TYPES.includes(r.transaction_type)) day.inflow += amount
    else if (OUTFLOW_TYPES.includes(r.transaction_type)) day.outflow += amount
    byDate.set(r.date, day)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Round to cents at every step. Accumulating floats and rounding only at the end
// lets sub-cent error ride along in the running balance and eventually trip the
// account_balances_arithmetic check constraint.
const cents = (n: number) => Math.round(n * 100) / 100

// Walk the daily totals forward from the anchor, producing one balance row per
// active date. Pure arithmetic — exported so tests can drive it directly.
export function runningBalances(
  anchorBalance: number,
  days: DailyTotals[],
): Omit<AccountBalance, 'account_id'>[] {
  let balance = cents(anchorBalance)
  return days.map(day => {
    const opening = balance
    const inflow = cents(day.inflow)
    const outflow = cents(day.outflow)
    balance = cents(opening + inflow - outflow)
    return {
      date: day.date,
      opening_balance: opening,
      inflow,
      outflow,
      closing_balance: balance,
    }
  })
}

// The most recent anchor on or before today — the point the series is rebuilt
// from. Later anchors (a reconciliation against the real bank balance) win over
// earlier ones, so drift can be corrected without rewriting history.
async function latestAnchor(accountId: number): Promise<BalanceAnchor | null> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('account_balance_anchors')
    .select('id, account_id, as_of_date, balance, note')
    .eq('account_id', accountId)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { ...(data as any), balance: Number((data as any).balance) } as BalanceAnchor
}

export type RebuildResult =
  | { status: 'rebuilt'; rows: number; currentBalance: number; projectedBalance: number }
  | { status: 'unchanged' }
  | { status: 'skipped'; reason: 'not-a-bank-account' | 'no-anchor' }

// Recompute one account's balance history from its anchor and refresh the cached
// figures. Idempotent: running it twice produces identical rows, so it is always
// safe to re-run, and re-running is the fix for any drift.
//
// `force` bypasses the digest short-circuit (used by tests and by an explicit
// "recalculate" action).
export async function rebuildAccountBalances(
  accountId: number,
  { force = false }: { force?: boolean } = {},
): Promise<RebuildResult> {
  const db = createFinancesAdminClient()

  const { data: account } = await db
    .from('accounts')
    .select('id, payment_method, account_type, balances_digest')
    .eq('id', accountId)
    .maybeSingle()
  if (!account) return { status: 'skipped', reason: 'not-a-bank-account' }
  const acct = account as { payment_method: string; account_type: string; balances_digest: string | null }

  // Credit cards carry a statement balance, not a cash balance; tracking one
  // here would invite reading it as money available.
  if (acct.account_type !== 'bank_account') return { status: 'skipped', reason: 'not-a-bank-account' }

  const anchor = await latestAnchor(accountId)
  if (!anchor) return { status: 'skipped', reason: 'no-anchor' }

  // Transactions are matched by payment_method: it is the only link between a
  // transaction and its account (there is no account_id on transactions).
  const { data: txRows } = await db
    .from('transactions')
    .select('id, date, amount, transaction_type')
    .eq('payment_method', acct.payment_method)
    .gte('date', anchor.as_of_date)
  const rows = (txRows ?? []) as SourceRow[]

  const digest = digestOf(rows)
  if (!force && digest === acct.balances_digest) return { status: 'unchanged' }

  const balances = runningBalances(anchor.balance, dailyTotals(rows))

  // Replace wholesale rather than diffing: the rebuild is the unit of work, and
  // a partial application is the one state that would leave balances wrong.
  const { error: delError } = await db
    .from('account_balances')
    .delete()
    .eq('account_id', accountId)
  if (delError) throw new Error(`balance rebuild (clear): ${delError.message}`)

  if (balances.length > 0) {
    const { error: insError } = await db
      .from('account_balances')
      .insert(balances.map(b => ({ ...b, account_id: accountId, user_id: ownerUserId() })))
    if (insError) throw new Error(`balance rebuild (insert): ${insError.message}`)
  }

  // `current` is the balance as of today; `projected` includes future-dated rows
  // (installments running years out), which is a forecast, not money you have.
  const today = new Date().toISOString().slice(0, 10)
  const current = [...balances].reverse().find(b => b.date <= today)
  const projected = balances.at(-1)

  const currentBalance = current?.closing_balance ?? anchor.balance
  const projectedBalance = projected?.closing_balance ?? anchor.balance

  const { error: updError } = await db
    .from('accounts')
    .update({
      current_balance: currentBalance,
      current_balance_date: current?.date ?? anchor.as_of_date,
      projected_balance: projectedBalance,
      balances_digest: digest,
      balances_updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
  if (updError) throw new Error(`balance rebuild (cache): ${updError.message}`)

  return { status: 'rebuilt', rows: balances.length, currentBalance, projectedBalance }
}

// Rebuild every bank account that has an anchor. Used after a transaction write
// (which may have touched any account) and on dashboard read, where the digest
// check makes the no-op case cheap.
export async function rebuildAllAccountBalances(
  opts: { force?: boolean } = {},
): Promise<Record<number, RebuildResult>> {
  const db = createFinancesAdminClient()
  const { data } = await db
    .from('accounts')
    .select('id')
    .eq('account_type', 'bank_account')

  const results: Record<number, RebuildResult> = {}
  for (const a of (data ?? []) as { id: number }[]) {
    results[a.id] = await rebuildAccountBalances(a.id, opts)
  }
  return results
}

// Balance history for one account, most recent first.
export async function getAccountBalances(
  accountId: number,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<AccountBalance[]> {
  const db = createFinancesAdminClient()
  let q = db
    .from('account_balances')
    .select('account_id, date, opening_balance, inflow, outflow, closing_balance')
    .eq('account_id', accountId)
    .order('date', { ascending: false })
  if (opts.from) q = q.gte('date', opts.from)
  if (opts.to) q = q.lte('date', opts.to)
  if (opts.limit) q = q.limit(opts.limit)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    account_id: r.account_id,
    date: r.date,
    opening_balance: Number(r.opening_balance),
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
    closing_balance: Number(r.closing_balance),
  }))
}

// Set (or re-set) where an account's balance series starts. Re-anchoring is how
// you snap balances back to the real bank figure after drift.
export async function setBalanceAnchor(
  accountId: number,
  asOfDate: string,
  balance: number,
  note: string | null = null,
): Promise<RebuildResult> {
  const db = createFinancesAdminClient()
  const { error } = await db
    .from('account_balance_anchors')
    .upsert(
      { account_id: accountId, as_of_date: asOfDate, balance, note, user_id: ownerUserId() },
      { onConflict: 'account_id,as_of_date' },
    )
  if (error) throw new Error(`set anchor: ${error.message}`)
  return rebuildAccountBalances(accountId, { force: true })
}
