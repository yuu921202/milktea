import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { fileName, contentType } = await req.json()

  const path = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await supabase.storage
    .from('product-images')
    .createSignedUploadUrl(path)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const publicUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
    publicUrl,
  })
}
