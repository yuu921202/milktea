'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint } from '@/types/database'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function PriceChart({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-amber-50 rounded-xl border border-amber-100 text-amber-400 text-sm">
        尚無價格資料，等待每日爬蟲執行後顯示
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: '#92400e' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#f97316' }}
            tickFormatter={(v) => `NT$${v}`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
            formatter={(value, name) => [
              `NT$${Number(value)}`,
              name === 'mercari_avg' ? 'Mercari 在售均價' : '近期成交均價',
            ]}
            labelFormatter={(label) => `日期：${label}`}
          />
          <Line
            type="monotone"
            dataKey="mercari_avg"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="mercari_sold_avg"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-orange-400"></span>在售均價
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-gray-400" style={{ borderTop: '2px dashed #9ca3af', background: 'none' }}></span>成交均價
        </span>
      </div>
    </div>
  )
}
