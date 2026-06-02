export interface ScrapeResult {
  success: boolean
  platform: 'mercari'
  listing_count: number
  avg_price: number | null
  min_price: number | null
  max_price: number | null
  sold_count: number | null
  sold_avg_price: number | null
  sold_min_price: number | null
  sold_max_price: number | null
  currency: string
  error?: string
  _alreadySaved?: boolean
}

export interface ProductScrapeTarget {
  id: string
  name: string
  search_keywords: string | null
  image_url?: string | null
}
