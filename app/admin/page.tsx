import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { ScrapeButton } from '@/components/ui/ScrapeButton'
import { deleteProduct } from '@/actions/products'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 週前`
  return `${Math.floor(days / 30)} 個月前`
}

export default async function AdminPage() {
  const supabase = createClient()

  const [{ data: products }, { data: priceRows }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase
      .from('price_history')
      .select('product_id, avg_price, scraped_at')
      .eq('platform', 'mercari')
      .order('scraped_at', { ascending: false })
      .limit(500),
  ])

  // Latest price per product (rows sorted DESC so first seen = latest)
  const latestPrice: Record<string, { avg_price: number | null; scraped_at: string }> = {}
  for (const row of priceRows ?? []) {
    if (!latestPrice[row.product_id]) latestPrice[row.product_id] = row
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/catalog" className="text-amber-500 hover:text-amber-700 text-sm">
              ← 收藏櫃
            </Link>
            <span className="text-amber-200">|</span>
            <h1 className="font-bold text-amber-800">商品管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <ScrapeButton />
            <Link
              href="/admin/new"
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + 新增商品
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-3">
        {!products?.length && (
          <div className="text-center py-16 text-amber-400">
            <p className="text-lg">還沒有任何商品</p>
            <Link href="/admin/new" className="text-sm underline mt-2 block">
              新增第一件商品
            </Link>
          </div>
        )}

        {products?.map((product) => {
          const price = latestPrice[product.id]
          return (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-amber-100 shadow-sm flex items-center gap-4 p-4"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-amber-50">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🐹</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge status={product.status} />
                  <CurrencyDisplay
                    amount={product.purchase_price}
                    currency={product.currency}
                    className="text-xs text-amber-600"
                  />
                </div>
                {/* Scrape status */}
                <div className="flex items-center gap-2 mt-1">
                  {price ? (
                    <>
                      <span className="text-xs text-gray-400">{timeAgo(price.scraped_at)}</span>
                      {price.avg_price != null && (
                        <span className="text-xs text-orange-500 font-medium">
                          均 NT${price.avg_price.toLocaleString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">尚未爬蟲</span>
                  )}
                </div>
              </div>

              {/* Actions — icon buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* View */}
                <Link
                  href={`/catalog/${product.id}`}
                  className="p-2 rounded-lg hover:bg-amber-50 text-amber-300 hover:text-amber-600 transition-colors"
                  title="查看詳情"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </Link>
                {/* Edit */}
                <Link
                  href={`/admin/${product.id}/edit`}
                  className="p-2 rounded-lg hover:bg-amber-50 text-amber-300 hover:text-amber-600 transition-colors"
                  title="編輯"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Link>
                {/* Scrape */}
                <ScrapeButton productId={product.id} productName={product.name} iconOnly />
                {/* Delete */}
                <DeleteButton
                  productName={product.name}
                  action={deleteProduct.bind(null, product.id)}
                  iconOnly
                />
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
