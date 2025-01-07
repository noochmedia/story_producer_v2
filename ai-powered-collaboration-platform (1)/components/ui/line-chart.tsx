import React from 'react'
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface LineChartProps {
  data: Array<{
    timestamp: string
    count: number
  }>
  xKey: string
  yKey: string
  label: string
}

export function LineChart({ data, xKey, yKey, label }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey={yKey} stroke="#8884d8" name={label} />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

