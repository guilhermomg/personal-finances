'use client'

import { useMemo, useState } from 'react'
import type { BillingPeriodOption } from '../../types/finance'

export type FilterMode = 'dateRange' | 'billingPeriod'

type Preset = 'last7' | 'last30' | 'last90' | 'monthToDate' | 'yearToDate' | 'lastYear'

export const PRESETS: { key: Preset; label: string }[] = [
  { key: 'last7',       label: 'Last 7 days' },
  { key: 'last30',      label: 'Last 30 days' },
  { key: 'last90',      label: 'Last 90 days' },
  { key: 'monthToDate', label: 'Month to date' },
  { key: 'yearToDate',  label: 'Year to date' },
  { key: 'lastYear',    label: 'Last year' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function pad(n: number) { return String(n).padStart(2, '0') }

function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function presetRange(key: Preset): [string, string] {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  switch (key) {
    case 'last7':       { const f = new Date(t); f.setDate(t.getDate() - 6); return [fmt(f), fmt(t)] }
    case 'last30':      { const f = new Date(t); f.setDate(t.getDate() - 29); return [fmt(f), fmt(t)] }
    case 'last90':      { const f = new Date(t); f.setDate(t.getDate() - 89); return [fmt(f), fmt(t)] }
    case 'monthToDate': return [fmt(new Date(t.getFullYear(), t.getMonth(), 1)), fmt(t)]
    case 'yearToDate':  return [`${t.getFullYear()}-01-01`, fmt(t)]
    case 'lastYear':    { const y = t.getFullYear() - 1; return [`${y}-01-01`, `${y}-12-31`] }
  }
}

export function detectPreset(from: string, to: string): Preset | null {
  for (const { key } of PRESETS) {
    const [f, t] = presetRange(key)
    if (f === from && t === to) return key
  }
  return null
}

function daysBetween(from: string, to: string): number | null {
  if (!from || !to) return null
  const diff = Math.round(
    (new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000
  ) + 1
  return diff >= 0 ? diff : null
}

function buildCalendar(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevTotal = new Date(year, month, 0).getDate()
  const cells: { date: string; day: number; cur: boolean }[] = []

  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevTotal - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    cells.push({ date: `${py}-${pad(pm + 1)}-${pad(d)}`, day: d, cur: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, day: d, cur: true })
  }
  const nm = month === 11 ? 0 : month + 1
  const ny = month === 11 ? year + 1 : year
  for (let d = 1; d <= 42 - cells.length; d++) {
    cells.push({ date: `${ny}-${pad(nm + 1)}-${pad(d)}`, day: d, cur: false })
  }
  return cells
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

export function DateBillingFilter({
  filterMode, onModeChange,
  dateFrom, dateTo, onDateChange,
  billingPeriods, selectedPeriodId, onPeriodChange,
}: Props) {
  const now = new Date()
  const todayStr = fmt(now)

  const initYear  = /^\d{4}/.test(dateFrom) ? parseInt(dateFrom) : now.getFullYear()
  const initMonth = /^\d{4}-(\d{2})/.test(dateFrom) ? parseInt(dateFrom.slice(5, 7)) - 1 : now.getMonth()

  const [calYear,  setCalYear]  = useState(initYear)
  const [calMonth, setCalMonth] = useState(initMonth)
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [periodSearch, setPeriodSearch] = useState('')

  const cells  = useMemo(() => buildCalendar(calYear, calMonth), [calYear, calMonth])
  const preset = detectPreset(dateFrom, dateTo)
  const days   = daysBetween(dateFrom, dateTo)

  const filteredPeriods = useMemo(() => {
    const q = periodSearch.trim().toLowerCase()
    return q ? billingPeriods.filter(p => p.name.toLowerCase().includes(q)) : billingPeriods
  }, [billingPeriods, periodSearch])

  function handleDayClick(date: string) {
    if (!dateFrom || (dateFrom && dateTo)) {
      onDateChange(date, '')
    } else if (date < dateFrom) {
      onDateChange(date, dateFrom)
    } else {
      onDateChange(dateFrom, date)
    }
  }

  function navMonth(dir: 1 | -1) {
    const nm = calMonth + dir
    if (nm < 0)  { setCalYear(y => y - 1); setCalMonth(11) }
    else if (nm > 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(nm)
  }

  type DayState = 'start' | 'end' | 'range' | 'hover-end' | 'hover-range' | null
  function dayState(date: string): DayState {
    if (date === dateFrom && dateFrom) return 'start'
    if (date === dateTo   && dateTo)   return 'end'
    if (dateFrom && dateTo && date > dateFrom && date < dateTo) return 'range'
    if (dateFrom && !dateTo && hovered) {
      const lo = dateFrom < hovered ? dateFrom : hovered
      const hi = dateFrom < hovered ? hovered  : dateFrom
      if (date === hovered) return 'hover-end'
      if (date > lo && date < hi) return 'hover-range'
    }
    return null
  }

  const inputSt: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '16px',
    padding: '8px 12px',
    outline: 'none',
    fontFamily: 'inherit',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    background: active ? 'rgba(200,245,90,0.1)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    borderRadius: '8px',
    color: active ? 'var(--text)' : 'var(--muted)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    padding: '8px 0',
    textAlign: 'center',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        gap: '3px',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '3px',
      }}>
        <button style={tabStyle(filterMode === 'dateRange')}    onClick={() => onModeChange('dateRange')}>Date range</button>
        <button style={tabStyle(filterMode === 'billingPeriod')} onClick={() => onModeChange('billingPeriod')}>Billing period</button>
      </div>

      {/* ── Date range ── */}
      {filterMode === 'dateRange' && (<>

        {/* Quick presets */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {PRESETS.map(({ key, label }) => {
            const active = preset === key
            return (
              <button
                key={key}
                onClick={() => {
                  const [f, t] = presetRange(key)
                  onDateChange(f, t)
                  setCalYear(parseInt(f.slice(0, 4)))
                  setCalMonth(parseInt(f.slice(5, 7)) - 1)
                }}
                style={{
                  background: active ? 'rgba(200,245,90,0.08)' : 'var(--surface2)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '7px 10px',
                  textAlign: 'left',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Date text inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input
            type="text"
            placeholder="yyyy-mm-dd"
            value={dateFrom}
            onChange={e => {
              const v = e.target.value
              onDateChange(v, dateTo)
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                setCalYear(parseInt(v.slice(0, 4)))
                setCalMonth(parseInt(v.slice(5, 7)) - 1)
              }
            }}
            style={inputSt}
          />
          <input
            type="text"
            placeholder="yyyy-mm-dd"
            value={dateTo}
            onChange={e => onDateChange(dateFrom, e.target.value)}
            style={inputSt}
          />
        </div>

        {/* Calendar */}
        <div>
          {/* Month nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button onClick={() => navMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 8px' }}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={() => navMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 8px' }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '2px' }}>
            {['S','M','T','W','T','F','S'].map((h, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--muted)', paddingBottom: '4px' }}>{h}</div>
            ))}
          </div>

          {/* Day cells */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
            onMouseLeave={() => setHovered(null)}
          >
            {cells.map(({ date, day, cur }) => {
              const ds = dayState(date)
              const highlighted = ds === 'start' || ds === 'end' || ds === 'hover-end'
              const inRange     = ds === 'range'  || ds === 'hover-range'
              const isToday     = date === todayStr

              return (
                <div
                  key={date}
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => setHovered(date)}
                  style={{
                    position: 'relative',
                    textAlign: 'center',
                    padding: '5px 1px',
                    cursor: 'pointer',
                    background: highlighted ? 'var(--accent)' : inRange ? 'rgba(200,245,90,0.15)' : 'transparent',
                    borderRadius: highlighted ? '6px' : 0,
                    zIndex: highlighted ? 1 : 0,
                  }}
                >
                  <span style={{
                    fontSize: '11px',
                    fontWeight: highlighted ? 700 : 400,
                    color: highlighted ? '#0e0f11' : cur ? 'var(--text)' : 'rgba(232,234,240,0.22)',
                  }}>
                    {day}
                  </span>
                  {isToday && (
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'block',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      background: highlighted ? '#0e0f11' : 'var(--accent)',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <button
            onClick={() => onDateChange('', '')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
          >
            Clear
          </button>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {days !== null
              ? `${days} day${days === 1 ? '' : 's'}`
              : dateFrom && !dateTo
              ? 'Pick end date'
              : 'Pick start & end'}
          </span>
        </div>
      </>)}

      {/* ── Billing period ── */}
      {filterMode === 'billingPeriod' && (<>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search billing period…"
            value={periodSearch}
            onChange={e => setPeriodSearch(e.target.value)}
            style={{ ...inputSt, paddingLeft: '34px' }}
          />
        </div>

        {/* Periods list */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {filteredPeriods.map((p, i) => (
            <div
              key={p.id}
              onClick={() => onPeriodChange(p.id === selectedPeriodId ? null : p.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                cursor: 'pointer',
                borderBottom: i < filteredPeriods.length - 1 ? '1px solid rgba(42,45,52,0.6)' : 'none',
                color: p.id === selectedPeriodId ? 'var(--text)' : 'var(--muted)',
                fontWeight: p.id === selectedPeriodId ? 600 : 400,
                fontSize: '13px',
              }}
            >
              <span>{p.name}</span>
              {p.status === 'open' && (
                <span style={{ color: 'var(--accent)', fontSize: '8px' }}>●</span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <button
            onClick={() => { onPeriodChange(null); setPeriodSearch('') }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
          >
            Clear
          </button>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {selectedPeriodId !== null ? '1 selected' : ''}
          </span>
        </div>
      </>)}

    </div>
  )
}
