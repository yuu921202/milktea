import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/types/database'
import { Badge } from '@/components/ui/Badge'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4"
      fill={filled ? '#f59e0b' : 'none'}
      stroke={filled ? '#f59e0b' : '#d1d5db'}
      strokeWidth="2"
    >
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  )
}

export function ProductCard({
  product,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  product: Product
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
  onSelect?: (product: Product) => void
}) {
  const isNew =
    product.acquisition_date != null &&
    Date.now() - new Date(product.acquisition_date).getTime() < SEVEN_DAYS

  return (
    <div className="relative group h-full">
      <Link
        href={`/catalog/${product.id}`}
        onClick={onSelect ? (e) => { e.preventDefault(); onSelect(product) } : undefined}
        className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-sm border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        {/* Image */}
        <div className="relative aspect-square bg-amber-50 overflow-hidden flex-shrink-0">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🐹</div>
          )}

          {/* NEW badge */}
          {isNew && (
            <span className="absolute top-2 left-2 bg-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm tracking-wide">
              NEW
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-sm font-semibold text-amber-900 line-clamp-2 leading-tight flex-1">
            {product.name}
          </p>
          <div className="flex items-center justify-between mt-2">
            <Badge status={product.status} compact />
            <CurrencyDisplay
              amount={product.purchase_price}
              currency={product.currency}
              className="text-xs font-medium text-amber-700"
            />
          </div>
        </div>
      </Link>

      {/* Star button — outside Link so clicks don't navigate */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors z-10"
          aria-label={isFavorite ? '取消收藏' : '加入收藏'}
        >
          <StarIcon filled={!!isFavorite} />
        </button>
      )}
    </div>
  )
}
