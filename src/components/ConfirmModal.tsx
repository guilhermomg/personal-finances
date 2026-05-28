'use client'

import { useEffect } from 'react'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', loading, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '360px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '16px' }}>
          {title}
        </span>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '8px 16px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: 'var(--danger)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              padding: '8px 20px',
            }}
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
