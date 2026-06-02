import { createClient } from '@/lib/supabase/server'
import { scrapeWithPlaywright } from './mercari'
import type { ProductScrapeTarget, ScrapeResult } from './types'

async function savePriceHistory(productId: string, result: ScrapeResult) {
  const supabase = createClient()
  await supabase.from('price_history').insert({
    product_id: productId,
    platform: result.platform,
    listing_count: result.listing_count,
    avg_price: result.avg_price,
    min_price: result.min_price,
    max_price: result.max_price,
    sold_count: result.sold_count ?? null,
    sold_avg_price: result.sold_avg_price ?? null,
    sold_min_price: result.sold_min_price ?? null,
    sold_max_price: result.sold_max_price ?? null,
    currency: result.currency,
    error_message: result.error ?? null,
  })
}

export async function scrapePricesForProduct(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const results = await scrapeWithPlaywright(product)
  for (const r of results) {
    if (!r._alreadySaved) await savePriceHistory(product.id, r)
  }
  return results
}
