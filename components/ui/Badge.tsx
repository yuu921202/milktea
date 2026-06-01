import type { ProductStatus } from '@/types/database'

const STATUS_MAP: Record<ProductStatus, { label: string; full: string; dot: string }> = {
  new:     { label: '全新', full: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
  used:    { label: '二手', full: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-400'  },
  damaged: { label: '損壞', full: 'bg-red-100 text-red-600',    dot: 'bg-red-400'   },
}

export function Badge({ status, compact }: { status: ProductStatus; compact?: boolean }) {
  const { label, full, dot } = STATUS_MAP[status]
  if (compact) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot}`}
        title={label}
      />
    )
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${full}`}>
      {label}
    </span>
  )
}
