import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import type { Cabinet, ProductStatus } from '@/types/database'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 text-center">
      <p className="text-3xl font-bold text-amber-800">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const STATUS_ORDER: ProductStatus[] = ['new', 'used', 'damaged']
const STATUS_LABEL: Record<ProductStatus, string> = { new: '全新', used: '二手', damaged: '已出售' }

const ACCENT: Record<string, { bar: string; text: string; count: string; bg: string }> = {
  amber:   { bar: 'bg-amber-400',   text: 'text-amber-700',   count: 'bg-amber-100 text-amber-600',   bg: 'bg-amber-50' },
  rose:    { bar: 'bg-rose-400',    text: 'text-rose-700',    count: 'bg-rose-100 text-rose-600',     bg: 'bg-rose-50' },
  sky:     { bar: 'bg-sky-400',     text: 'text-sky-700',     count: 'bg-sky-100 text-sky-600',       bg: 'bg-sky-50' },
  emerald: { bar: 'bg-emerald-400', text: 'text-emerald-700', count: 'bg-emerald-100 text-emerald-600', bg: 'bg-emerald-50' },
  violet:  { bar: 'bg-violet-400',  text: 'text-violet-700',  count: 'bg-violet-100 text-violet-600', bg: 'bg-violet-50' },
  orange:  { bar: 'bg-orange-400',  text: 'text-orange-700',  count: 'bg-orange-100 text-orange-600', bg: 'bg-orange-50' },
}

export default async function StatsPage() {
  const supabase = createClient()

  const [{ data: products }, { data: cabinets }, { data: latestPriceRows }] = await Promise.all([
    supabase.from('products').select('*').order('acquisition_date', { ascending: false }),
    supabase.from('cabinets').select('*').order('created_at'),
    supabase
      .from('price_history')
      .select('product_id, avg_price, scraped_at')
      .eq('platform', 'mercari')
      .order('scraped_at', { ascending: false })
      .limit(500),
  ])

  const list = products ?? []
  const cabinetList = cabinets ?? []

  // Latest scrape per product
  const latestPrice: Record<string, number | null> = {}
  for (const row of latestPriceRows ?? []) {
    if (!(row.product_id in latestPrice)) latestPrice[row.product_id] = row.avg_price
  }

  // Overall stats
  const totalSpent = list.reduce((s, p) => s + (p.purchase_price ?? 0), 0)
  const byStatus = Object.fromEntries(
    STATUS_ORDER.map(s => [s, list.filter(p => p.status === s)])
  ) as Record<ProductStatus, typeof list>
  const recent = list.slice(0, 5)
  const withPrice = list.filter(p => latestPrice[p.id] != null)
  const totalMarket = withPrice.reduce((s, p) => s + (latestPrice[p.id] ?? 0), 0)
  const avgMarket = withPrice.length > 0 ? Math.round(totalMarket / withPrice.length) : null

  // Per-cabinet stats
  const grouped: Record<string, typeof list> = {}
  for (const c of cabinetList) grouped[c.id] = []
  for (const p of list) {
    if (p.cabinet_id && grouped[p.cabinet_id] !== undefined) grouped[p.cabinet_id].push(p)
  }

  function cabinetStats(items: typeof list) {
    const spent = items.reduce((s, p) => s + (p.purchase_price ?? 0), 0)
    const marketItems = items.filter(p => latestPrice[p.id] != null)
    const marketTotal = marketItems.reduce((s, p) => s + (latestPrice[p.id] ?? 0), 0)
    return {
      count: items.length,
      spent,
      newCount: items.filter(p => p.status === 'new').length,
      usedCount: items.filter(p => p.status === 'used').length,
      damagedCount: items.filter(p => p.status === 'damaged').length,
      marketTotal: marketItems.length > 0 ? marketTotal : null,
    }
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/catalog" className="text-amber-500 hover:text-amber-700 text-sm">
            ← 返回
          </Link>
          <span className="text-amber-200">|</span>
          <h1 className="font-bold text-amber-800">收藏統計</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── 全體總覽 ── */}
        <section>
          <h2 className="text-xs font-semibold text-amber-500 mb-3 uppercase tracking-wide">全體總覽</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="總收藏數" value={list.length} sub="件" />
            <StatCard label="全新" value={byStatus.new.length} sub="件" />
            <StatCard label="二手" value={byStatus.used.length} sub="件" />
            <StatCard
              label="總入手花費"
              value={totalSpent > 0 ? `NT$${totalSpent.toLocaleString()}` : '—'}
            />
          </div>
        </section>

        {/* ── 市場參考 ── */}
        {withPrice.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-amber-500 mb-3 uppercase tracking-wide">市場參考（Mercari）</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="已有市場資料" value={withPrice.length} sub={`共 ${list.length} 件`} />
              <StatCard
                label="市場均價平均"
                value={avgMarket != null ? `NT$${avgMarket.toLocaleString()}` : '—'}
              />
              <StatCard
                label="市場總估值"
                value={totalMarket > 0 ? `NT$${totalMarket.toLocaleString()}` : '—'}
                sub="在售均價加總"
              />
            </div>
          </section>
        )}

        {/* ── 各展示櫃 ── */}
        {cabinetList.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-amber-500 mb-3 uppercase tracking-wide">各展示櫃</h2>
            <div className="space-y-3">
              {cabinetList.map(cabinet => {
                const items = grouped[cabinet.id] ?? []
                const s = cabinetStats(items)
                const a = ACCENT[cabinet.color] ?? ACCENT.amber
                return (
                  <Link
                    key={cabinet.id}
                    href={`/cabinet/${cabinet.id}`}
                    className="block bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className={`${a.bar} h-1.5`} />
                    <div className="p-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cabinet.emoji}</span>
                          <span className={`font-bold ${a.text}`}>{cabinet.name} 的展示櫃</span>
                        </div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${a.count}`}>
                          {s.count} 件
                        </span>
                      </div>

                      {s.count === 0 ? (
                        <p className="text-sm text-gray-300 italic">還沒有收藏</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          {/* Spent */}
                          <div className={`${a.bg} rounded-xl py-2.5 px-3`}>
                            <p className="text-sm font-bold text-gray-700">
                              {s.spent > 0 ? `NT$${s.spent.toLocaleString()}` : '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">花費</p>
                          </div>
                          {/* Status breakdown */}
                          <div className={`${a.bg} rounded-xl py-2.5 px-3`}>
                            <p className="text-sm font-bold text-gray-700">{s.newCount}</p>
                            <p className="text-xs text-gray-400 mt-0.5">全新</p>
                          </div>
                          <div className={`${a.bg} rounded-xl py-2.5 px-3`}>
                            <p className="text-sm font-bold text-gray-700">{s.usedCount}</p>
                            <p className="text-xs text-gray-400 mt-0.5">二手</p>
                          </div>
                          {/* Market */}
                          <div className={`${a.bg} rounded-xl py-2.5 px-3`}>
                            <p className="text-sm font-bold text-gray-700">
                              {s.marketTotal != null ? `NT$${s.marketTotal.toLocaleString()}` : '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">市場估值</p>
                          </div>
                        </div>
                      )}

                      {/* Product list */}
                      {items.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {items.slice(0, 5).map(p => (
                            <div key={p.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge status={p.status} compact />
                                <span className="text-sm text-gray-600 truncate">{p.name}</span>
                              </div>
                              <CurrencyDisplay
                                amount={p.purchase_price}
                                currency={p.currency}
                                className="text-xs text-gray-400 flex-shrink-0 ml-2"
                              />
                            </div>
                          ))}
                          {items.length > 5 && (
                            <p className="text-xs text-gray-300 text-right pt-1">
                              還有 {items.length - 5} 件 →
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 最近入手 ── */}
        {recent.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-amber-500 mb-3 uppercase tracking-wide">最近入手</h2>
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm divide-y divide-amber-50">
              {recent.map(p => {
                const cab = cabinetList.find(c => c.id === p.cabinet_id)
                return (
                  <Link
                    key={p.id}
                    href={`/catalog/${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge status={p.status} compact />
                      <span className="text-sm text-gray-700 truncate group-hover:text-amber-700">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {cab && (
                        <span className="text-xs text-gray-300">{cab.emoji} {cab.name}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {p.acquisition_date ?? '—'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
