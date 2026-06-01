'use client'

import { useState } from 'react'
import { ImageUpload } from './ImageUpload'
import type { Cabinet, Product } from '@/types/database'

interface ProductFormProps {
  product?: Product
  cabinets: Cabinet[]
  defaultCabinetId?: string
  action: (formData: FormData) => Promise<void | { error: string }>
  submitLabel: string
}

export function ProductForm({ product, cabinets, defaultCabinetId, action, submitLabel }: ProductFormProps) {
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '')
  const [imagePath, setImagePath] = useState(product?.image_path ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('image_url', imageUrl)
    formData.set('image_path', imagePath)
    await action(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">商品圖片</label>
        <ImageUpload
          currentImageUrl={product?.image_url}
          onUpload={({ imageUrl: url, imagePath: path }) => {
            setImageUrl(url)
            setImagePath(path)
          }}
        />
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          品項名稱 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          defaultValue={product?.name}
          required
          placeholder="例：倉鼠 L 號娃娃 2024 年款"
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">入手價格（TWD）</label>
        <input
          type="number"
          name="purchase_price"
          defaultValue={product?.purchase_price ?? ''}
          min={0}
          placeholder="例：850"
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
        <select
          name="status"
          defaultValue={product?.status ?? 'new'}
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
        >
          <option value="new">全新</option>
          <option value="used">二手</option>
          <option value="damaged">損壞</option>
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">入手日期</label>
        <input
          type="date"
          name="acquisition_date"
          defaultValue={product?.acquisition_date ?? ''}
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* Search keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          爬蟲關鍵字
          <span className="text-gray-400 font-normal ml-1 text-xs">（不填則自動用品項名稱）</span>
        </label>
        <input
          type="text"
          name="search_keywords"
          defaultValue={product?.search_keywords ?? ''}
          placeholder="例：ポムポムプリン L ぬいぐるみ"
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* Cabinet */}
      {cabinets.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">展示櫃（擁有者）</label>
          <select
            name="cabinet_id"
            defaultValue={product?.cabinet_id ?? defaultCabinetId ?? ''}
            className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
          >
            <option value="">— 未分配 —</option>
            {cabinets.map(c => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name} 的展示櫃
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
        <textarea
          name="notes"
          defaultValue={product?.notes ?? ''}
          rows={3}
          placeholder="任何補充說明..."
          className="w-full px-4 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  )
}
