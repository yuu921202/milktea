import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapePricesForProduct } from '@/lib/scrapers'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, type SessionData } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Require login session
  const session = await getIronSession<SessionData>(cookies(), sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { productId } = await req.json().catch(() => ({}))

  const supabase = createClient()

  let query = supabase.from('products').select('id, name, search_keywords, image_url')
  if (productId) {
    query = query.eq('id', productId)
  }

  const { data: products, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!products?.length) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const results = []
  for (const product of products) {
    const res = await scrapePricesForProduct(product)
    results.push({ id: product.id, name: product.name, results: res })
  }

  // Build a human-readable summary per platform
  const summary: Record<string, string> = {}
  for (const { results: res } of results) {
    for (const r of res) {
      if (r.success && r.listing_count > 0) {
        const sym = r.currency === 'TWD' ? 'NT$' : r.currency === 'CNY' ? '¥' : r.currency
        summary[r.platform] = `${r.listing_count} 筆，均 ${sym}${r.avg_price}`
      } else if (!r.success) {
        summary[r.platform] = r.error ?? '失敗'
      } else {
        summary[r.platform] = '0 筆'
      }
    }
  }

  return NextResponse.json({ scraped: products.length, results, summary })
}
