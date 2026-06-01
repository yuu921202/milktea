'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ProductStatus } from '@/types/database'

export async function createCabinet(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const supabase = createClient()
  const { error } = await supabase.from('cabinets').insert({
    name: formData.get('name') as string,
    emoji: (formData.get('emoji') as string) || '🐹',
    color: (formData.get('color') as string) || 'amber',
  })
  if (error) return { error: error.message }
  revalidatePath('/catalog')
}

export async function createProduct(formData: FormData) {
  const supabase = createClient()
  const cabinetId = (formData.get('cabinet_id') as string) || null
  const { error } = await supabase.from('products').insert({
    name: formData.get('name') as string,
    purchase_price: formData.get('purchase_price')
      ? Number(formData.get('purchase_price'))
      : null,
    currency: 'TWD',
    status: (formData.get('status') as ProductStatus) || 'new',
    acquisition_date: (formData.get('acquisition_date') as string) || null,
    notes: (formData.get('notes') as string) || null,
    search_keywords: (formData.get('search_keywords') as string) || null,
    image_url: (formData.get('image_url') as string) || null,
    image_path: (formData.get('image_path') as string) || null,
    cabinet_id: cabinetId,
  })

  if (error) return { error: error.message }
  revalidatePath('/catalog')
  revalidatePath('/admin')
  if (cabinetId) revalidatePath(`/cabinet/${cabinetId}`)
  redirect('/admin')
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = createClient()
  const cabinetId = (formData.get('cabinet_id') as string) || null
  const { error } = await supabase
    .from('products')
    .update({
      name: formData.get('name') as string,
      purchase_price: formData.get('purchase_price')
        ? Number(formData.get('purchase_price'))
        : null,
      status: (formData.get('status') as ProductStatus) || 'new',
      acquisition_date: (formData.get('acquisition_date') as string) || null,
      notes: (formData.get('notes') as string) || null,
      search_keywords: (formData.get('search_keywords') as string) || null,
      image_url: (formData.get('image_url') as string) || null,
      image_path: (formData.get('image_path') as string) || null,
      cabinet_id: cabinetId,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/catalog')
  revalidatePath('/admin')
  revalidatePath(`/catalog/${id}`)
  if (cabinetId) revalidatePath(`/cabinet/${cabinetId}`)
  redirect('/admin')
}

export async function deleteProduct(id: string) {
  const supabase = createClient()

  // Remove image from storage if exists
  const { data: product } = await supabase
    .from('products')
    .select('image_path')
    .eq('id', id)
    .single()

  if (product?.image_path) {
    await supabase.storage.from('product-images').remove([product.image_path])
  }

  await supabase.from('products').delete().eq('id', id)
  revalidatePath('/catalog')
  revalidatePath('/admin')
  redirect('/admin')
}
