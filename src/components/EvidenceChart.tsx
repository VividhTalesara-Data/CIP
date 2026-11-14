import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Evidence } from '../domain/types.ts'

export default function EvidenceChart({ rows, unit }: { rows: Evidence['rows']; unit: string }) {
  const reduced = useReducedMotion()
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: -20 }} barGap={5}>
      <CartesianGrid vertical={false} stroke="#e9ede8" strokeDasharray="3 4" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} dy={6} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#647269' }} unit={unit === '%' ? '%' : ''} />
      <Tooltip cursor={{ fill: '#f1f5f0' }} contentStyle={{ borderRadius: 10, border: '1px solid #dfe5dd', fontSize: 12 }} />
      <Bar dataKey="baseline" name="Comparison" fill="#c7d7ca" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} animationDuration={400} />
      <Bar dataKey="current" name="Selected period" fill="#3c6853" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} animationDuration={400} />
    </BarChart>
  </ResponsiveContainer>
}
