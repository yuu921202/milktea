import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CatalogShell } from '@/components/catalog/CatalogShell'
import { logout } from '@/actions/auth'

export default async function AllProductsPage() {
  const supabase = createClient()

  const [{ data: products, error }, { data: priceRows }] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('acquisition_date', { ascending: false }),
    supabase
      .from('price_history')
      .select('product_id, avg_price, sold_avg_price, scraped_at')
      .eq('platform', 'mercari')
      .order('scraped_at', { ascending: false })
      .limit(500),
  ])

  const latestPrices: Record<string, { avg_price: number | null; sold_avg_price: number | null }> = {}
  for (const row of priceRows ?? []) {
    if (!latestPrices[row.product_id]) {
      latestPrices[row.product_id] = { avg_price: row.avg_price, sold_avg_price: row.sold_avg_price }
    }
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/catalog"
              className="text-amber-400 hover:text-amber-600 flex-shrink-0 p-1 -ml-1"
              title="返回"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span className="text-xl">🐹</span>
            <h1 className="text-xl font-bold text-amber-800">全部收藏</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/stats" className="text-sm text-amber-600 hover:text-amber-800 font-medium hidden sm:block">
              統計
            </Link>
            <Link href="/admin" className="text-sm text-amber-600 hover:text-amber-800 font-medium">
              管理
            </Link>
            <form action={logout}>
              <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {error ? (
          <div className="text-red-500 text-center py-10">載入失敗</div>
        ) : (
          <>
            <p className="text-xs text-amber-400 mb-4">共 {products?.length ?? 0} 件收藏</p>
            <CatalogShell
              products={products ?? []}
              latestPrices={latestPrices}
            />
          </>
        )}
      </main>
    </div>
  )
}
