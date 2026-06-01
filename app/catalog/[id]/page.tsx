import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import { PriceChart } from '@/components/product/PriceChart'
import { ScrapeButton } from '@/components/ui/ScrapeButton'
import type { ChartDataPoint, PriceHistory } from '@/types/database'

function buildChartData(history: PriceHistory[]): ChartDataPoint[] {
  const byDate: Record<string, ChartDataPoint> = {}
  for (const row of history) {
    if (row.platform !== 'mercari') continue
    const date = row.scraped_at.slice(0, 10)
    if (!byDate[date]) byDate[date] = { date }
    byDate[date].mercari_avg = row.avg_price ?? undefined
    byDate[date].mercari_min = row.min_price ?? undefined
    byDate[date].mercari_max = row.max_price ?? undefined
    byDate[date].mercari_count = row.listing_count
    byDate[date].mercari_sold_avg = row.sold_avg_price ?? undefined
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
}

const STATUS_LABEL: Record<string, string> = {
  new: '全新',
  used: '二手',
  damaged: '損壞',
}

function NavArrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
      {direction === 'left'
        ? <path d="M15 18l-6-6 6-6" />
        : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const [{ data: product }, { data: history }, { data: allIds }] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).single(),
    supabase
      .from('price_history')
      .select('*')
      .eq('product_id', params.id)
      .eq('platform', 'mercari')
      .order('scraped_at', { ascending: true })
      .limit(90),
    supabase
      .from('products')
      .select('id')
      .order('acquisition_date', { ascending: false }),
  ])

  if (!product) notFound()

  const currentIndex = allIds?.findIndex(p => p.id === params.id) ?? -1
  const prevId = currentIndex > 0 ? allIds![currentIndex - 1].id : null
  const nextId = currentIndex < (allIds?.length ?? 0) - 1 ? allIds![currentIndex + 1].id : null

  const chartData = buildChartData(history ?? [])
  const latestMercari = (history ?? []).filter((h) => h.avg_price || h.sold_avg_price).at(-1)

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/catalog" className="text-amber-500 hover:text-amber-700 text-sm">
            ← 返回收藏櫃
          </Link>

          {/* Prev / Next navigation */}
          <div className="flex items-center gap-1">
            {prevId ? (
              <Link
                href={`/catalog/${prevId}`}
                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-700 transition-colors"
                title="上一件"
              >
                <NavArrow direction="left" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-200">
                <NavArrow direction="left" />
              </span>
            )}
            <span className="text-xs text-gray-300 px-1">
              {currentIndex + 1} / {allIds?.length ?? 1}
            </span>
            {nextId ? (
              <Link
                href={`/catalog/${nextId}`}
                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-700 transition-colors"
                title="下一件"
              >
                <NavArrow direction="right" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-200">
                <NavArrow direction="right" />
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image */}
            <div className="relative aspect-square bg-amber-50">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">
                  🐹
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <Badge status={product.status} />
                <h1 className="text-xl font-bold text-amber-900 mt-2">{product.name}</h1>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-amber-50">
                  <span className="text-gray-500">入手價格</span>
                  <CurrencyDisplay
                    amount={product.purchase_price}
                    currency={product.currency}
                    className="font-semibold text-amber-800"
                  />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-amber-50">
                  <span className="text-gray-500">入手日期</span>
                  <span className="text-amber-800">
                    {product.acquisition_date ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-amber-50">
                  <span className="text-gray-500">狀態</span>
                  <span className="text-amber-800">
                    {STATUS_LABEL[product.status]}
                  </span>
                </div>
              </div>

              {/* Latest market price */}
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-600 mb-3">市場參考價（最新一筆）</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-orange-500">🇯🇵 Mercari 在售均價</span>
                  <CurrencyDisplay
                    amount={latestMercari?.avg_price ?? null}
                    currency="TWD"
                    className="font-medium text-orange-600"
                  />
                </div>
                {latestMercari?.sold_avg_price != null && (
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-gray-500">📦 近期成交均價</span>
                    <CurrencyDisplay
                      amount={latestMercari.sold_avg_price}
                      currency="TWD"
                      className="font-medium text-gray-600"
                    />
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <ScrapeButton productId={product.id} productName={product.name} />
                </div>
              </div>

              {product.notes && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                  <span className="font-medium text-gray-700 block mb-1">備註</span>
                  {product.notes}
                </div>
              )}

              <Link
                href={`/admin/${product.id}/edit`}
                className="mt-auto text-center text-sm text-amber-500 hover:text-amber-700 border border-amber-200 rounded-lg py-2 hover:bg-amber-50 transition-colors"
              >
                編輯商品資料
              </Link>
            </div>
          </div>

          {/* Price chart */}
          <div className="p-6 border-t border-amber-100">
            <h2 className="font-semibold text-amber-800 mb-4">價格趨勢（近 90 天）</h2>
            <PriceChart data={chartData} />
          </div>
        </div>
      </main>
    </div>
  )
}
