'use client'

import { useEffect, useRef, useState } from 'react'
import type { BillingPeriodOption } from '../../types/finance'

interface Props {
  periods: BillingPeriodOption[]
  selectedId: number | null
  onChange: (id: number | null) => void
}

export function PeriodCombobox({ periods, selectedId, onChange }: Props) {
  const selected = periods.find(p => p.id === selectedId) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync input text when selectedId changes externally (e.g. initial load)
  useEffect(() => {
    setQuery(selected?.name ?? '')
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user clicked away without selecting, restore the current selection's label
        setQuery(selected?.name ?? '')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [selected])

  const filtered = query.trim()
    ? periods.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : periods

  function select(period: BillingPeriodOption) {
    onChange(period.id)
    setQuery(period.name)
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 200px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search billing period…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          style={{
            width: '100%',
            background: 'var(--surface2)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '8px',
            color: 'var(--text)',
            fontSize: '16px',
            padding: '6px 32px 6px 12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {selectedId !== null && (
          <button
            onClick={clear}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              padding: 0,
            }}
            title="Clear"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: '260px',
          overflowY: 'auto',
          zIndex: 50,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
              No periods match
            </div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onMouseDown={() => select(p)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: hovered === p.id ? 'var(--surface2)' : 'transparent',
                  color: p.id === selectedId ? 'var(--text)' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{p.name}</span>
                {p.status === 'open' && (
                  <span style={{ color: 'var(--accent)', fontSize: '9px' }}>●</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
