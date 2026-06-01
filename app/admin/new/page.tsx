import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/product/ProductForm'
import { createProduct } from '@/actions/products'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { cabinet?: string }
}) {
  const supabase = createClient()
  const { data: cabinets } = await supabase.from('cabinets').select('*').order('name')

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="text-amber-500 hover:text-amber-700 text-sm">
            ← 管理頁面
          </Link>
          <span className="text-amber-200">|</span>
          <h1 className="font-bold text-amber-800">新增商品</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
          <ProductForm
            action={createProduct}
            submitLabel="新增商品"
            cabinets={cabinets ?? []}
            defaultCabinetId={searchParams.cabinet}
          />
        </div>
      </main>
    </div>
  )
}
