import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapePricesForProduct } from '@/lib/scrapers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Vercel sends CRON_SECRET automatically; also allow manual trigger with same header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, search_keywords')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!products?.length) {
    return NextResponse.json({ message: 'No products to scrape', scraped: 0 })
  }

  const results = []
  for (const product of products) {
    try {
      const res = await scrapePricesForProduct(product)
      results.push({ id: product.id, name: product.name, results: res })
    } catch (e) {
      results.push({ id: product.id, name: product.name, error: String(e) })
    }
  }

  return NextResponse.json({
    scraped: products.length,
    timestamp: new Date().toISOString(),
    results,
  })
}
