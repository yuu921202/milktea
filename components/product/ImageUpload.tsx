'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface UploadResult {
  imageUrl: string
  imagePath: string
}

export function ImageUpload({
  currentImageUrl,
  onUpload,
}: {
  currentImageUrl?: string | null
  onUpload: (result: UploadResult) => void
}) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)

    // Get signed upload URL from our API route
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type }),
    })
    const { signedUrl, path, publicUrl, error } = await res.json()
    if (error) {
      alert('上傳失敗：' + error)
      setUploading(false)
      return
    }

    // Upload directly to Supabase Storage
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!uploadRes.ok) {
      alert('上傳失敗')
      setUploading(false)
      return
    }

    setPreview(publicUrl)
    onUpload({ imageUrl: publicUrl, imagePath: path })
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className="relative border-2 border-dashed border-amber-200 rounded-xl overflow-hidden cursor-pointer hover:border-amber-400 transition-colors"
      style={{ aspectRatio: '1/1', maxWidth: 200 }}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {preview ? (
        <Image src={preview} alt="商品圖片" fill className="object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-amber-300 text-sm gap-2 p-4">
          <span className="text-3xl">📷</span>
          <span>點擊或拖曳上傳圖片</span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <span className="text-amber-600 text-sm">上傳中...</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
