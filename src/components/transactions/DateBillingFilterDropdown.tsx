'use client'

import { useEffect, useRef, useState } from 'react'
import type { BillingPeriodOption } from '../../types/finance'
import { DateBillingFilter, PRESETS, presetRange, type FilterMode } from './DateBillingFilter'

function getTriggerLabel(
  filterMode: FilterMode,
  dateFrom: string,
  dateTo: string,
  selectedPeriodId: number | null,
  billingPeriods: BillingPeriodOption[],
): string {
  if (filterMode === 'billingPeriod' && selectedPeriodId !== null) {
    return billingPeriods.find(p => p.id === selectedPeriodId)?.name ?? 'Any time'
  }
  if (filterMode === 'dateRange') {
    if (!dateFrom && !dateTo) return 'Any time'
    // Check presets
    for (const { key, label } of PRESETS) {
      const [f, t] = presetRange(key)
      if (f === dateFrom && t === dateTo) return label
    }
    // Custom range
    if (dateFrom && dateTo) return `${dateFrom.slice(5)} → ${dateTo.slice(5)}`
    if (dateFrom) return `From ${dateFrom.slice(5)}`
    if (dateTo) return `Until ${dateTo.slice(5)}`
  }
  return 'Any time'
}

type Props = {
  filterMode: FilterMode
  onModeChange: (mode: FilterMode) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
  billingPeriods: BillingPeriodOption[]
  selectedPeriodId: number | null
  onPeriodChange: (id: number | null) => void
}

export function DateBillingFilterDropdown({
  filterMode, onModeChange,
  dateFrom, dateTo, onDateChange,
  billingPeriods, selectedPeriodId, onPeriodChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const hasFilter =
    (filterMode === 'billingPeriod' && selectedPeriodId !== null) ||
    (filterMode === 'dateRange' && (!!dateFrom || !!dateTo))

  const label = getTriggerLabel(filterMode, dateFrom, dateTo, selectedPeriodId, billingPeriods)

  return (
    <div ref={containerRef} style={{ position: 'relative' }} className="tx-when-trigger">

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: hasFilter ? 'rgba(200,245,90,0.08)' : 'var(--surface2)',
          border: `1px solid ${hasFilter || open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: '8px',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '12px',
          padding: '7px 12px',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--muted)', flexShrink: 0 }}>When</span>
        <span style={{ fontWeight: hasFilter ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: '9px', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 200,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          width: 'max(100%, 320px)',
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <DateBillingFilter
            filterMode={filterMode}
            onModeChange={onModeChange}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={onDateChange}
            billingPeriods={billingPeriods}
            selectedPeriodId={selectedPeriodId}
            onPeriodChange={onPeriodChange}
          />
        </div>
      )}
    </div>
  )
}
