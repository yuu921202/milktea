import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/product/ProductForm'
import { updateProduct } from '@/actions/products'

export default async function EditProductPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const [{ data: product }, { data: cabinets }] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).single(),
    supabase.from('cabinets').select('*').order('name'),
  ])

  if (!product) notFound()

  const updateAction = updateProduct.bind(null, params.id)

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="text-amber-500 hover:text-amber-700 text-sm">
            ← 管理頁面
          </Link>
          <span className="text-amber-200">|</span>
          <h1 className="font-bold text-amber-800">編輯商品</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
          <ProductForm
            product={product}
            action={updateAction}
            submitLabel="儲存變更"
            cabinets={cabinets ?? []}
          />
        </div>
      </main>
    </div>
  )
}
