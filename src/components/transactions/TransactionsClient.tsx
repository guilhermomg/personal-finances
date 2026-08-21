'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Chip } from '../Chip'
import { chipProps } from '../chipUtils'
import { formatCurrency, txDisplaySign, txTypeLabel, txIsCredit } from '../../lib/format'
import { MultiSelect } from './MultiSelect'
import { DateBillingFilterDropdown } from './DateBillingFilterDropdown'
import { type FilterMode } from './DateBillingFilter'
import { TransactionModal } from './TransactionModal'
import { RecurringEditModal } from './RecurringEditModal'
import { FAB } from '../FAB'
import type { Transaction, Account, BillingPeriodOption, PaymentStyleMap } from '../../types/finance'

type SortKey = 'date' | 'description' | 'category' | 'amount'
type SortDir = 'asc' | 'desc'
type RecurringFilter = 'all' | 'recurring' | 'one-time'

const SORT_LABELS: Record<SortKey, string> = {
  date: 'Date',
  description: 'Description',
  category: 'Category',
  amount: 'Amount',
}

// Persisted "When" filter (date range / billing period) so a user's choice
// survives navigation for the rest of the browser-tab session.
const WHEN_STORAGE_KEY = 'tx-when-filter'
type SavedWhenFilter = { mode: FilterMode; periodId: number | null; dateFrom: string; dateTo: string }

// Tooltip listing every category split of a transaction, e.g. "Groceries: $60 · Home: $40".
function splitTitle(t: Transaction): string {
  return (t.allocations ?? []).map(a => `${a.category}: ${formatCurrency(Number(a.amount))}`).join('  ·  ')
}

function SplitBadge({ t }: { t: Transaction }) {
  if (!t.allocations || t.allocations.length <= 1) return null
  return (
    <span title={splitTitle(t)} style={{ color: 'var(--accent2)', fontSize: '11px', marginLeft: '4px' }}>
      +{t.allocations.length - 1}
    </span>
  )
}

function loadSavedWhenFilter(): SavedWhenFilter | null {
  try {
    const raw = sessionStorage.getItem(WHEN_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedWhenFilter) : null
  } catch {
    return null
  }
}

export function TransactionsClient({ transactions, billingPeriods, initialPeriodId, initialDateFrom, initialDateTo, initialWhenFromUrl, accounts, allCategories, incomeCategories, paymentStyles }: {
  transactions: Transaction[]
  billingPeriods: BillingPeriodOption[]
  initialPeriodId: number | null
  initialDateFrom?: string
  initialDateTo?: string
  /** True when the URL explicitly set the When-filter (?month=/?from=/?to=). */
  initialWhenFromUrl: boolean
  accounts: Account[]
  allCategories: string[]
  incomeCategories: string[]
  paymentStyles: PaymentStyleMap
}) {
  const searchParams = useSearchParams()
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [descSearch, setDescSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    const category = searchParams.get('category')
    return category ? new Set([category]) : new Set()
  })
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(() => {
    const method = searchParams.get('method')
    return method ? new Set([method]) : new Set()
  })
  const [recurringFilter, setRecurringFilter] = useState<RecurringFilter>('all')
  const [filterMode, setFilterMode] = useState<FilterMode>(initialPeriodId !== null ? 'billingPeriod' : 'dateRange')
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(initialPeriodId)
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? '')
  const [dateTo, setDateTo] = useState(initialDateTo ?? '')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // When the URL didn't specify a When-filter, restore the one the user last
  // chose this session (read after mount to avoid an SSR hydration mismatch).
  useEffect(() => {
    if (initialWhenFromUrl) return
    const saved = loadSavedWhenFilter()
    if (!saved) return
    setFilterMode(saved.mode)
    setSelectedPeriodId(saved.periodId)
    setDateFrom(saved.dateFrom)
    setDateTo(saved.dateTo)
  }, [initialWhenFromUrl])

  // Persist the When-filter whenever the user changes it. Skips the first run so
  // the initial (URL- or default-derived) values don't clobber a saved filter
  // before the restore effect above can read it.
  const skipWhenSave = useRef(true)
  useEffect(() => {
    if (skipWhenSave.current) { skipWhenSave.current = false; return }
    try {
      sessionStorage.setItem(
        WHEN_STORAGE_KEY,
        JSON.stringify({ mode: filterMode, periodId: selectedPeriodId, dateFrom, dateTo }),
      )
    } catch {
      // ignore quota/availability errors — persistence is best-effort
    }
  }, [filterMode, selectedPeriodId, dateFrom, dateTo])

  const todayStr = new Date().toISOString().split('T')[0]

  // Scroll to the first today-row on mount — only in dateRange mode when today is within range.
  const todayRowRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => {
    if (filterMode !== 'dateRange') return
    const inRange =
      (!dateFrom || todayStr >= dateFrom) &&
      (!dateTo   || todayStr <= dateTo)
    if (inRange && todayRowRef.current) {
      todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once after initial render

  function switchMode(mode: FilterMode) {
    setFilterMode(mode)
    if (mode === 'billingPeriod') {
      setDateFrom('')
      setDateTo('')
    } else {
      setSelectedPeriodId(null)
    }
  }

  const allMethods = useMemo(
    () => [...new Set(transactions.map(t => t.payment_method))].sort(),
    [transactions]
  )

  const allProviders = useMemo(
    () => [...new Set(transactions.map(t => t.payment_provider).filter((p): p is string => !!p))].sort(),
    [transactions]
  )

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let rows = transactions

    if (descSearch.trim()) {
      const q = descSearch.toLowerCase()
      rows = rows.filter(t => t.description.toLowerCase().includes(q))
    }
    if (selectedCategories.size > 0)
      rows = rows.filter(t => t.allocations && t.allocations.length > 0
        ? t.allocations.some(a => selectedCategories.has(a.category))
        : selectedCategories.has(t.category))
    if (selectedMethods.size > 0)
      rows = rows.filter(t => selectedMethods.has(t.payment_method))
    if (recurringFilter === 'recurring') rows = rows.filter(t => t.recurring_transaction_id !== null)
    if (recurringFilter === 'one-time') rows = rows.filter(t => t.recurring_transaction_id === null)

    if (filterMode === 'dateRange') {
      if (dateFrom) rows = rows.filter(t => t.date >= dateFrom)
      if (dateTo)   rows = rows.filter(t => t.date <= dateTo)
    } else if (filterMode === 'billingPeriod' && selectedPeriodId !== null) {
      const period = billingPeriods.find(p => p.id === selectedPeriodId)
      if (period) {
        const cycleIdSet = new Set(period.cycleIds)
        rows = rows.filter(t => t.billing_cycle_id !== null && cycleIdSet.has(t.billing_cycle_id))
      }
    }

    return [...rows].sort((a, b) => {
      const aVal = sortKey === 'amount' ? Number(a.amount) : String(a[sortKey]).toLowerCase()
      const bVal = sortKey === 'amount' ? Number(b.amount) : String(b[sortKey]).toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [transactions, billingPeriods, descSearch, selectedCategories, selectedMethods, recurringFilter, filterMode, dateFrom, dateTo, selectedPeriodId, sortKey, sortDir])

  const mobileGroups = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
    const map = new Map<string, typeof filtered>()
    for (const t of sorted) {
      const group = map.get(t.date)
      if (group) group.push(t)
      else map.set(t.date, [t])
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <>
      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: '16px' }}>

        {/* Row 1: description search — always full width */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none', flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search description…"
              value={descSearch}
              onChange={e => setDescSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '16px',
                padding: '6px 12px 6px 34px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Row 2: recurring pill + When dropdown + Category + Payment */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Recurring filter — pill segmented control */}
          <div className="tx-filter-pill" style={{
            display: 'flex',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '3px',
          }}>
            {(['all', 'recurring', 'one-time'] as RecurringFilter[]).map(opt => {
              const active = recurringFilter === opt
              return (
                <button
                  key={opt}
                  onClick={() => setRecurringFilter(opt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: active ? 'var(--surface)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: '8px',
                    color: active ? 'var(--text)' : 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: active ? 500 : 400,
                    padding: '4px 12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {active && <span style={{ color: 'var(--accent)', fontSize: '7px', lineHeight: 1 }}>●</span>}
                  <span style={{ textTransform: 'capitalize' }}>{opt}</span>
                </button>
              )
            })}
          </div>

          {/* When… dropdown */}
          <DateBillingFilterDropdown
            filterMode={filterMode}
            onModeChange={switchMode}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
            billingPeriods={billingPeriods}
            selectedPeriodId={selectedPeriodId}
            onPeriodChange={setSelectedPeriodId}
          />

          {/* Category + Payment */}
          <MultiSelect
            label="Category"
            options={allCategories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            className="tx-multiselect"
          />
          <MultiSelect
            label="Payment"
            options={allMethods}
            selected={selectedMethods}
            onChange={setSelectedMethods}
            className="tx-multiselect"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="tx-table" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{
                      cursor: 'pointer',
                      textAlign: key === 'amount' ? 'right' : 'left',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {SORT_LABELS[key]}
                    {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </th>
                ))}
                <th>Method</th>
                <th>Provider</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let firstTodayFound = false
                return filtered.map(t => {
                  const isFirstToday = t.date === todayStr && !firstTodayFound
                  if (isFirstToday) firstTodayFound = true
                  return (
                <tr key={t.id} ref={isFirstToday ? todayRowRef : null} onClick={() => setEditingTransaction(t)} style={{ cursor: 'pointer', opacity: t.date > todayStr ? 0.35 : undefined }}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '12px' }}>
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ maxWidth: '220px' }}>
                    <span>
                      {t.description}
                      {t.installment_number !== null && (
                        <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                          {' '}({t.installment_number}/{t.installment_total})
                        </span>
                      )}
                    </span>
                    {t.notes && (
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '2px' }}>
                        {t.notes}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.category}<SplitBadge t={t} /></td>
                  <td className="td-amt" style={txIsCredit(t.transaction_type) ? { color: '#34c759' } : undefined}>
                    {formatCurrency(txDisplaySign(t.transaction_type) * Number(t.amount))}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', paddingLeft: '12px' }}>
                    <Chip {...chipProps(paymentStyles, t.payment_method)} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {t.payment_provider && (
                      <Chip {...chipProps(paymentStyles, t.payment_provider)} />
                    )}
                  </td>
                  <td>
                    {txTypeLabel(t.transaction_type) ? (
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: '99px',
                        fontWeight: 500,
                        letterSpacing: '0.5px',
                        background: txIsCredit(t.transaction_type) ? 'rgba(52,199,89,0.15)' : 'var(--surface2)',
                        color: txIsCredit(t.transaction_type) ? '#34c759' : 'var(--muted)',
                        border: txIsCredit(t.transaction_type) ? '1px solid rgba(52,199,89,0.3)' : '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {txTypeLabel(t.transaction_type)}
                      </span>
                    ) : t.recurring_transaction_id !== null ? (
                      <span style={{ fontSize: '10px', color: 'var(--accent2)', letterSpacing: '0.5px' }}>
                        recurring
                      </span>
                    ) : null}
                  </td>
                </tr>
                  )
                })
              })()}
            </tbody>
            <tfoot>
              <tr className="table-foot">
                <td colSpan={3}>Total</td>
                <td className="td-amt">
                  {formatCurrency(filtered.reduce((s, t) => s + txDisplaySign(t.transaction_type) * Number(t.amount), 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Mobile list ── */}
        <div className="tx-list">
          {mobileGroups.map(([date, items]) => (
            <div key={date}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.5px',
                padding: '12px 0 6px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '2px',
              }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </div>
              {items.map((t, i) => (
                <div
                  key={t.id}
                  className="tx-list-row"
                  onClick={() => setEditingTransaction(t)}
                  style={{ cursor: 'pointer', borderBottom: i < items.length - 1 ? undefined : 'none', opacity: t.date > todayStr ? 0.35 : undefined }}
                >
                  <div className="tx-list-top">
                    <span className="tx-list-desc" style={{ marginLeft: 0 }}>
                      {t.description}
                      {t.installment_number !== null && (
                        <span style={{ color: 'var(--muted)', fontSize: '11px' }}> ({t.installment_number}/{t.installment_total})</span>
                      )}
                    </span>
                    <span className="tx-list-amount" style={txIsCredit(t.transaction_type) ? { color: '#34c759' } : undefined}>
                      {formatCurrency(txDisplaySign(t.transaction_type) * Number(t.amount))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <Chip {...chipProps(paymentStyles, t.payment_method)} />
                    {t.payment_provider && (
                      <Chip {...chipProps(paymentStyles, t.payment_provider)} />
                    )}
                    {txTypeLabel(t.transaction_type) && (
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: '99px',
                        fontWeight: 500,
                        letterSpacing: '0.5px',
                        background: txIsCredit(t.transaction_type) ? 'rgba(52,199,89,0.15)' : 'var(--surface2)',
                        color: txIsCredit(t.transaction_type) ? '#34c759' : 'var(--muted)',
                        border: txIsCredit(t.transaction_type) ? '1px solid rgba(52,199,89,0.3)' : '1px solid var(--border)',
                      }}>
                        {txTypeLabel(t.transaction_type)}
                      </span>
                    )}
                    <span className="tx-list-sub" style={{ marginTop: 0 }}>· {t.category}<SplitBadge t={t} /></span>
                  </div>
                  {t.notes && (
                    <div style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '3px' }}>
                      {t.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div className="tx-list-footer">
            <span>Total</span>
            <span>{formatCurrency(filtered.reduce((s, t) => s + txDisplaySign(t.transaction_type) * Number(t.amount), 0))}</span>
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>
          {filtered.length} of {transactions.length} transactions
        </div>
      </div>
      {editingTransaction && (
        editingTransaction.recurring_transaction_id !== null ? (
          <RecurringEditModal
            recurringTransactionId={editingTransaction.recurring_transaction_id}
            description={editingTransaction.description}
            category={editingTransaction.category}
            amount={editingTransaction.amount}
            payment_method={editingTransaction.payment_method}
            transaction={editingTransaction}
            allCategories={allCategories}
            allMethods={allMethods}
            accounts={accounts}
            onClose={() => setEditingTransaction(null)}
          />
        ) : (
          <TransactionModal
            transaction={editingTransaction}
            allCategories={allCategories}
            incomeCategories={incomeCategories}
            allMethods={allMethods}
            allProviders={allProviders}
            accounts={accounts}
            onClose={() => setEditingTransaction(null)}
          />
        )
      )}
      <FAB allCategories={allCategories} incomeCategories={incomeCategories} allMethods={allMethods} allProviders={allProviders} accounts={accounts} />
    </>
  )
}
