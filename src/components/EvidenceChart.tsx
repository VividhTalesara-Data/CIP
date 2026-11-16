import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Evidence } from '../domain/types.ts'

export default function EvidenceChart({ rows, unit, mode = 'comparison' }: { rows: Evidence['rows']; unit: string; mode?: 'comparison' | 'change' }) {
  const reduced = useReducedMotion()
  if (mode === 'change') return <ResponsiveContainer width="100%" height="100%">
    <BarChart layout="vertical" data={rows.map(row => ({ ...row, change: Number((row.current - row.baseline).toFixed(2)) }))} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
      <CartesianGrid horizontal={false} stroke="#e9ede8" strokeDasharray="3 4" />
      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} unit={unit === '%' ? ' pp' : ''} />
      <YAxis type="category" dataKey="label" width={95} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} />
      <ReferenceLine x={0} stroke="#7e9687" />
      <Tooltip cursor={{ fill: '#f1f5f0' }} contentStyle={{ borderRadius: 10, border: '1px solid #dfe5dd', fontSize: 12 }} />
      <Bar dataKey="change" name={unit === '%' ? 'Change (percentage points)' : `Change (${unit})`} fill="#406d7b" radius={3} maxBarSize={32} isAnimationActive={!reduced} animationDuration={300} />
    </BarChart>
  </ResponsiveContainer>
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: -20 }} barGap={5}>
      <CartesianGrid vertical={false} stroke="#e9ede8" strokeDasharray="3 4" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} dy={6} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} unit={unit === '%' ? '%' : ''} />
      <Tooltip cursor={{ fill: '#f1f5f0' }} contentStyle={{ borderRadius: 10, border: '1px solid #dfe5dd', fontSize: 12 }} />
      <Bar dataKey="baseline" name="Comparison" fill="#708f7d" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} animationDuration={400} />
      <Bar dataKey="current" name="Selected period" fill="#3c6853" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} animationDuration={400} />
    </BarChart>
  </ResponsiveContainer>
}
