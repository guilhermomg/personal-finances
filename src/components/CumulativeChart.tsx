'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { CumulativePoint } from '../types/finance'

const ACTUAL      = '#c8f55a'
const RECURRING   = '#5af5c8'
const INSTALLMENT = '#f5a85a'
const GRID        = '#2a2d34'
const MUTED       = '#6b7180'
const SURFACE     = '#1e2126'

function formatCurrency(v: number) {
  return `$${v.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${GRID}`,
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '11px',
      minWidth: '160px',
    }}>
      <div style={{ color: MUTED, marginBottom: '6px', letterSpacing: '0.5px' }}>
        {formatDay(label)}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: p.color, marginBottom: '2px' }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Only label every ~7 days to avoid crowding
function buildTicks(data: CumulativePoint[]) {
  if (data.length === 0) return []
  const ticks: string[] = [data[0].date]
  for (let i = 7; i < data.length; i += 7) ticks.push(data[i].date)
  const last = data[data.length - 1].date
  if (ticks[ticks.length - 1] !== last) ticks.push(last)
  return ticks
}

export function CumulativeChart({ data }: { data: CumulativePoint[] }) {
  const ticks = buildTicks(data)
  const maxVal = data.length > 0 ? data[data.length - 1].actual : 0

  return (
    <div className="card">
      <div className="section-title">
        <span className="dot" style={{ background: ACTUAL }} />
        Spending Over Time
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ACTUAL} stopOpacity={0.18} />
              <stop offset="95%" stopColor={ACTUAL} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={formatDay}
            tick={{ fill: MUTED, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: MUTED, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, Math.ceil(maxVal * 1.1) || 100]}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: '11px', color: MUTED, paddingTop: '8px' }}
          />

          {/* Recurring — bottom layer */}
          <Line
            dataKey="recurring"
            name="Recurring"
            stroke={RECURRING}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
          />

          {/* Installments */}
          <Line
            dataKey="installments"
            name="Installments"
            stroke={INSTALLMENT}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
          />

          {/* Actual — top, most prominent */}
          <Area
            dataKey="actual"
            name="Actual"
            stroke={ACTUAL}
            strokeWidth={2.5}
            fill="url(#actualGrad)"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
