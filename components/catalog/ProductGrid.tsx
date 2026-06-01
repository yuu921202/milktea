import type { Product } from '@/types/database'
import { ProductCard } from './ProductCard'

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-20 text-amber-400">
        <span className="text-6xl mb-4">📦</span>
        <p className="text-lg font-medium">收藏櫃是空的</p>
        <p className="text-sm mt-1">
          去{' '}
          <a href="/admin/new" className="underline hover:text-amber-600">
            新增商品
          </a>{' '}
          填滿它！
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
