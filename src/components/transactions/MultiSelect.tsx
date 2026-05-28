'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  className?: string
}

export function MultiSelect({ label, options, selected, onChange, className }: Props) {
  const [open, setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options
  }, [options, search])

  const count = selected.size
  const hasFilter = count > 0

  const valueLabel =
    count === 0 ? 'All'
    : count === 1 ? [...selected][0]
    : `${count} selected`

  function toggle(opt: string) {
    const next = new Set(selected)
    next.has(opt) ? next.delete(opt) : next.add(opt)
    onChange(next)
  }

  function clear() { onChange(new Set()) }

  function selectAll() { onChange(new Set(filtered)) }

  return (
    <div ref={ref} className={className} style={{ position: 'relative' }}>

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          background: hasFilter ? 'rgba(200,245,90,0.08)' : 'var(--surface2)',
          border: `1px solid ${hasFilter || open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: '8px',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '12px',
          padding: '7px 12px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
        <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{valueLabel}</span>
        <span style={{ color: 'var(--muted)', fontSize: '9px', flexShrink: 0, marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
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
          width: 'max(100%, 280px)',
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>

          {/* Header */}
          <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {label}
          </div>

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
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '16px',
                padding: '8px 12px 8px 34px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filtered.map((opt, i) => (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 0',
                  cursor: 'pointer',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(42,45,52,0.6)' : 'none',
                  fontSize: '13px',
                  color: selected.has(opt) ? 'var(--text)' : 'var(--muted)',
                  fontWeight: selected.has(opt) ? 500 : 400,
                }}
              >
                <input
                  type="checkbox"
                  className="fin-checkbox"
                  checked={selected.has(opt)}
                  onChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button
              onClick={clear}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
            >
              Clear
            </button>
            <button
              onClick={selectAll}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: 0 }}
            >
              Select all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
