import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CatalogShell } from '@/components/catalog/CatalogShell'
import { logout } from '@/actions/auth'

const ACCENT: Record<string, { bar: string; text: string }> = {
  amber:   { bar: 'bg-amber-400',   text: 'text-amber-800' },
  rose:    { bar: 'bg-rose-400',    text: 'text-rose-800' },
  sky:     { bar: 'bg-sky-400',     text: 'text-sky-800' },
  emerald: { bar: 'bg-emerald-400', text: 'text-emerald-800' },
  violet:  { bar: 'bg-violet-400',  text: 'text-violet-800' },
  orange:  { bar: 'bg-orange-400',  text: 'text-orange-800' },
}

export default async function CabinetPage({
  params,
}: {
  params: { cabinetId: string }
}) {
  const supabase = createClient()

  const [{ data: cabinet }, { data: products, error }, { data: priceRows }] = await Promise.all([
    supabase.from('cabinets').select('*').eq('id', params.cabinetId).single(),
    supabase
      .from('products')
      .select('*')
      .eq('cabinet_id', params.cabinetId)
      .order('acquisition_date', { ascending: false }),
    supabase
      .from('price_history')
      .select('product_id, avg_price, sold_avg_price, scraped_at')
      .eq('platform', 'mercari')
      .order('scraped_at', { ascending: false })
      .limit(500),
  ])

  if (!cabinet) notFound()

  const latestPrices: Record<string, { avg_price: number | null; sold_avg_price: number | null }> = {}
  for (const row of priceRows ?? []) {
    if (!latestPrices[row.product_id]) {
      latestPrices[row.product_id] = { avg_price: row.avg_price, sold_avg_price: row.sold_avg_price }
    }
  }

  const a = ACCENT[cabinet.color] ?? ACCENT.amber

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Color accent strip at very top */}
      <div className={`${a.bar} h-1`} />

      <header className="bg-white/90 backdrop-blur-sm border-b border-amber-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <span className="text-xl flex-shrink-0">{cabinet.emoji}</span>
            <h1 className={`text-lg font-bold truncate ${a.text}`}>
              {cabinet.name} 的展示櫃
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
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

      {/* FAB */}
      <Link
        href={`/admin/new?cabinet=${cabinet.id}`}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="新增收藏"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </Link>

      <div className="max-w-2xl mx-auto px-3 py-6 pb-24">
        {error ? (
          <div className="text-red-500 text-center py-10">載入失敗</div>
        ) : (
          <CatalogShell
            products={products ?? []}
            latestPrices={latestPrices}
            shelf
            cabinetId={params.cabinetId}
            cabinetEmoji={cabinet.emoji}
          />
        )}
        <p className="text-center text-sm mt-4 px-3 py-1 rounded-full bg-white/70 backdrop-blur-sm w-fit mx-auto text-amber-700">
          共 {products?.length ?? 0} 件收藏
        </p>
      </div>
    </div>
  )
}
