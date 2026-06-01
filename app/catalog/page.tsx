import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { CabinetCarousel } from '@/components/catalog/CabinetCarousel'
import type { ProductPreview } from '@/components/catalog/CabinetCarousel'

export default async function CatalogPage() {
  const supabase = createClient()

  const [{ data: cabinets }, { data: products }] = await Promise.all([
    supabase.from('cabinets').select('*').order('created_at'),
    supabase
      .from('products')
      .select('id, name, image_url, cabinet_id')
      .order('acquisition_date', { ascending: false }),
  ])

  const cabinetList = cabinets ?? []
  const all = products ?? []

  // Group product previews per cabinet
  const grouped: Record<string, ProductPreview[]> = {}
  for (const c of cabinetList) grouped[c.id] = []
  for (const p of all) {
    if (p.cabinet_id && grouped[p.cabinet_id] !== undefined) {
      grouped[p.cabinet_id].push({ id: p.id, name: p.name, image_url: p.image_url })
    }
  }
  const unassigned = all.filter(p => !p.cabinet_id)

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐹</span>
            <h1 className="text-xl font-bold text-amber-800">倉鼠幫</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/stats" className="text-sm text-amber-600 hover:text-amber-800 font-medium">
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-5">
          選擇展示櫃
        </p>

        <CabinetCarousel cabinets={cabinetList} grouped={grouped} />

        {/* Unassigned warning */}
        {unassigned.length > 0 && (
          <div className="mt-6 flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
            <span className="text-sm text-amber-700">
              ⚠️ 有 {unassigned.length} 件商品尚未分配到展示櫃
            </span>
            <Link href="/admin" className="text-sm text-amber-600 font-medium underline ml-3 flex-shrink-0">
              前往管理
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
