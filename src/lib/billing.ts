import { createFinancesAdminClient, ownerUserId } from './supabase/admin'

// Given a transaction date and a card's cycle_start_day, returns the YYYY-MM
// of the billing period that transaction belongs to.
// e.g. May 3 with cycle_start_day=5 → "2026-04" (before the 5th, still April's cycle)
// e.g. May 6 with cycle_start_day=5 → "2026-05" (on or after the 5th, May's cycle)
export function periodMonthForDate(dateStr: string, cycleStartDay: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (day >= cycleStartDay) {
    return `${year}-${String(month).padStart(2, '0')}`
  }
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Returns the existing billing period for a given YYYY-MM, or creates it
// (along with its billing_cycles) from the active billing_cycle_configs.
export async function getOrCreatePeriod(yearMonth: string): Promise<{
  id: number
  name: string
  start_month: string
  end_month: string | null
  status: string
}> {
  const db = createFinancesAdminClient()
  const startMonth = `${yearMonth}-01`

  const [year, month] = yearMonth.split('-').map(Number)
  // Placeholder name used only if the period is brand-new; it gets overwritten below.
  const placeholderName = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Upsert: insert if not exists, do nothing on conflict, then fetch the row.
  // This is safe under concurrent requests unlike check-then-insert.
  await db
    .from('billing_periods')
    .upsert({ name: placeholderName, start_month: startMonth, status: 'open', user_id: ownerUserId() }, { onConflict: 'start_month', ignoreDuplicates: true })

  const { data: period, error: periodError } = await db
    .from('billing_periods')
    .select('id, name, start_month, end_month, status')
    .eq('start_month', startMonth)
    .single()

  if (periodError || !period) throw new Error(`Failed to get billing period: ${periodError?.message}`)

  const { data: configs } = await db
    .from('billing_cycle_configs')
    .select('id, cycle_start_day, cycle_end_day, payment_due_day')
    .eq('active', true)

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const pad = (n: number) => String(n).padStart(2, '0')

  const cycles = (configs ?? []).map((config: any) => {
    const endDateStr = `${nextYear}-${pad(nextMonth)}-${pad(config.cycle_end_day)}`
    let dueDateStr: string | null = null
    if (config.payment_due_day) {
      const endDate = new Date(endDateStr + 'T00:00:00')
      endDate.setDate(endDate.getDate() + config.payment_due_day)
      dueDateStr = endDate.toISOString().split('T')[0]
    }
    return {
      billing_period_id: period.id,
      config_id: config.id,
      start_date: `${year}-${pad(month)}-${pad(config.cycle_start_day)}`,
      end_date: endDateStr,
      due_date: dueDateStr,
      status: 'open',
      user_id: ownerUserId(),
    }
  })

  // Derive the period's end_month from the latest cycle end_date (first day of that month).
  // All cycles for a period end in nextYear-nextMonth, so this is deterministic.
  // Format: "May 2026" (same month), "May – Jun 2026" (same year), "Dec 2026 – Jan 2027" (cross-year).
  const endMonthStr = cycles.length > 0 ? `${nextYear}-${pad(nextMonth)}-01` : null
  const [endYear, endMonth] = endMonthStr
    ? endMonthStr.split('-').map(Number)
    : [year, month]

  let periodName: string
  if (endYear === year && endMonth === month) {
    // Same month — keep long form: "May 2026"
    periodName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (endYear === year) {
    // Same year — omit year from start: "May – Jun 2026"
    const startLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
    const endLabel   = new Date(endYear, endMonth - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    periodName = `${startLabel} – ${endLabel}`
  } else {
    // Cross-year: "Dec 2026 – Jan 2027"
    const startLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const endLabel   = new Date(endYear, endMonth - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    periodName = `${startLabel} – ${endLabel}`
  }

  // UPDATE name and end_month unconditionally so existing periods self-heal on next load.
  await db.from('billing_periods').update({ name: periodName, end_month: endMonthStr }).eq('id', period.id)

  // Upsert cycles — the unique constraint on (billing_period_id, config_id)
  // ensures concurrent requests never produce duplicates.
  await db
    .from('billing_cycles')
    .upsert(cycles, { onConflict: 'billing_period_id,config_id', ignoreDuplicates: true })

  // Seed recurring transaction records for any cycle that doesn't have them yet.
  // Fetch cycles (with date ranges), configs, templates, and existing recurring txs in parallel.
  const { data: periodCycles } = await db
    .from('billing_cycles')
    .select('id, config_id, start_date, end_date')
    .eq('billing_period_id', period.id)

  if (periodCycles && periodCycles.length > 0) {
    const cycleIds = periodCycles.map((c: any) => c.id as number)
    const configIds = periodCycles.map((c: any) => c.config_id as number)

    const [configsRes, templatesRes, existingTxsRes] = await Promise.all([
      db.from('billing_cycle_configs').select('id, payment_method').in('id', configIds),
      db.from('recurring_transactions').select('id, description, category, amount, payment_method, frequency, start_date, day_of_month').eq('active', true),
      db.from('transactions').select('recurring_transaction_id, billing_cycle_id').in('billing_cycle_id', cycleIds).not('recurring_transaction_id', 'is', null),
    ])

    const configMap = Object.fromEntries((configsRes.data ?? []).map((c: any) => [c.id, c]))
    const existingSet = new Set(
      (existingTxsRes.data ?? []).map((t: any) => `${t.recurring_transaction_id}-${t.billing_cycle_id}`)
    )

    const txsToInsert: any[] = []
    for (const cycle of periodCycles) {
      const config = configMap[cycle.config_id]
      if (!config) continue

      const matchingTemplates = (templatesRes.data ?? []).filter((rt: any) => {
        if (rt.payment_method !== config.payment_method) return false
        // Don't seed into periods before the template's start month
        if (rt.start_date.slice(0, 7) > `${year}-${pad(month)}`) return false
        if (rt.frequency !== 'monthly') return rt.start_date.slice(5, 7) === pad(month)
        return true
      })

      for (const rt of matchingTemplates) {
        if (existingSet.has(`${rt.id}-${cycle.id}`)) continue

        const templateDay = rt.day_of_month
          ? String(rt.day_of_month).padStart(2, '0')
          : (rt.start_date as string).slice(8, 10)

        // Walk forward from the cycle's start month until we find the day within the date range.
        // This handles both standard cycles and irregular first-statement windows.
        const [sYear, sMon] = (cycle.start_date as string).split('-').map(Number)
        let expectedDate: string | null = null
        let cYear = sYear, cMon = sMon
        for (let i = 0; i < 3; i++) {
          const candidate = `${cYear}-${pad(cMon)}-${templateDay}`
          if (candidate >= cycle.start_date && candidate <= cycle.end_date) {
            expectedDate = candidate
            break
          }
          cMon++
          if (cMon > 12) { cMon = 1; cYear++ }
        }
        if (!expectedDate) continue

        txsToInsert.push({
          date: expectedDate,
          description: rt.description,
          category: rt.category,
          amount: rt.amount,
          payment_method: config.payment_method,
          payment_provider: null,
          recurring: true,
          billing_cycle_id: cycle.id,
          recurring_transaction_id: rt.id,
          transaction_id: `recurring-${rt.id}-${yearMonth}`,
          user_id: ownerUserId(),
        })
      }
    }

    if (txsToInsert.length > 0) {
      await db.from('transactions').insert(txsToInsert)
    }
  }

  // Carry forward budgets from the most recent previous period that has any,
  // but only if this period has none yet.
  const { count } = await db
    .from('budgets')
    .select('id', { count: 'exact', head: true })
    .eq('billing_period_id', period.id)

  if (!count) {
    const { data: prevPeriod } = await db
      .from('billing_periods')
      .select('id')
      .lt('start_month', startMonth)
      .order('start_month', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevPeriod) {
      const { data: prevBudgets } = await db
        .from('budgets')
        .select('category, amount')
        .eq('billing_period_id', prevPeriod.id)

      if (prevBudgets && prevBudgets.length > 0) {
        await db.from('budgets').insert(
          prevBudgets.map((b: any) => ({ billing_period_id: period.id, category: b.category, amount: b.amount, user_id: ownerUserId() })),
        )
      }
    }
  }

  return { ...period, name: periodName, end_month: endMonthStr }
}

// Resolves (or creates) the billing_cycle_id for a transaction given an explicit
// statement_date (the date the billing cycle closes). Used when the user overrides
// the auto-computed cycle for boundary-date transactions.
export async function getOrCreateCycleByStatementDate(
  statementDate: string,
  paymentMethod: string,
): Promise<number | null> {
  const db = createFinancesAdminClient()

  const { data: config } = await db
    .from('billing_cycle_configs')
    .select('id')
    .eq('payment_method', paymentMethod)
    .eq('active', true)
    .maybeSingle()

  if (!config) return null

  // The billing period is one month before the statement close month.
  // e.g. statement_date 2026-05-05 → period month 2026-04 (April closes May 5)
  const [year, month] = statementDate.split('-').map(Number)
  const periodYear = month === 1 ? year - 1 : year
  const periodMonth = month === 1 ? 12 : month - 1
  const yearMonth = `${periodYear}-${String(periodMonth).padStart(2, '0')}`

  const period = await getOrCreatePeriod(yearMonth)

  const { data: cycle } = await db
    .from('billing_cycles')
    .select('id')
    .eq('billing_period_id', period.id)
    .eq('config_id', config.id)
    .maybeSingle()

  return cycle?.id ?? null
}

// Resolves (or creates) the billing_cycle_id for a transaction given its date
// and payment_method. Returns null if no matching config exists.
export async function getOrCreateCycleForTransaction(
  dateStr: string,
  paymentMethod: string,
): Promise<number | null> {
  const db = createFinancesAdminClient()

  const { data: config } = await db
    .from('billing_cycle_configs')
    .select('id, cycle_start_day')
    .eq('payment_method', paymentMethod)
    .eq('active', true)
    .maybeSingle()

  if (!config) return null

  const yearMonth = periodMonthForDate(dateStr, config.cycle_start_day)
  const period = await getOrCreatePeriod(yearMonth)

  const { data: cycle } = await db
    .from('billing_cycles')
    .select('id')
    .eq('billing_period_id', period.id)
    .eq('config_id', config.id)
    .maybeSingle()

  return cycle?.id ?? null
}
