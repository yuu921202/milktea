const CURRENCY_FORMAT: Record<string, { locale: string; symbol: string }> = {
  TWD: { locale: 'zh-TW', symbol: 'NT$' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  CNY: { locale: 'zh-CN', symbol: 'RMB¥' },
}

export function CurrencyDisplay({
  amount,
  currency,
  className,
}: {
  amount: number | null
  currency: string
  className?: string
}) {
  if (amount === null) return <span className={className}>—</span>

  const fmt = CURRENCY_FORMAT[currency] ?? { locale: 'en', symbol: currency }
  const formatted = new Intl.NumberFormat(fmt.locale, {
    maximumFractionDigits: 0,
  }).format(amount)

  return (
    <span className={className}>
      {fmt.symbol}
      {formatted}
    </span>
  )
}
