'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import type { Product } from '@/types/database'

type MarketPrice = { avg_price: number | null; sold_avg_price: number | null } | null | undefined

export function QuickViewDrawer({
  product,
  marketPrice,
  onClose,
}: {
  product: Product | null
  marketPrice: MarketPrice
  onClose: () => void
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [current, setCurrent] = useState<Product | null>(product)

  useEffect(() => {
    if (product) {
      setCurrent(product)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      const t = setTimeout(() => setCurrent(null), 280)
      return () => clearTimeout(t)
    }
  }, [product])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [product])

  if (!current) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-lg mx-auto transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Content */}
        <div className="flex gap-4 px-5 pb-4">
          {/* Image */}
          <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-amber-50">
            {current.image_url ? (
              <Image
                src={current.image_url}
                alt={current.name}
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🐶</div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-900 leading-snug">{current.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge status={current.status} />
              <CurrencyDisplay
                amount={current.purchase_price}
                currency={current.currency}
                className="text-sm text-amber-700 font-medium"
              />
            </div>
            {current.acquisition_date && (
              <p className="text-xs text-gray-400 mt-1">入手：{current.acquisition_date}</p>
            )}
            {marketPrice?.avg_price != null && (
              <p className="text-sm text-gray-500 mt-1.5">
                市場均價{' '}
                <span className="text-orange-500 font-semibold">
                  NT${marketPrice.avg_price.toLocaleString()}
                </span>
              </p>
            )}
            {marketPrice?.sold_avg_price != null && (
              <p className="text-xs text-gray-400">
                近期成交 NT${marketPrice.sold_avg_price.toLocaleString()}
              </p>
            )}
            {current.notes && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">{current.notes}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-safe">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium hover:bg-amber-50 transition-colors"
          >
            關閉
          </button>
          <Link
            href={`/catalog/${current.id}`}
            className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 rounded-xl text-white text-sm font-semibold text-center transition-colors"
          >
            查看完整詳情 →
          </Link>
        </div>
      </div>
    </>
  )
}
