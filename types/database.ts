export type ProductStatus = 'new' | 'used' | 'damaged'
export type ScrapePlatform = 'mercari'

export interface Cabinet {
  id: string
  name: string
  emoji: string
  color: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  image_url: string | null
  image_path: string | null
  purchase_price: number | null
  currency: string
  status: ProductStatus
  acquisition_date: string | null
  notes: string | null
  search_keywords: string | null
  cabinet_id: string | null
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface PriceHistory {
  id: string
  product_id: string
  platform: ScrapePlatform
  scraped_at: string
  listing_count: number
  avg_price: number | null
  min_price: number | null
  max_price: number | null
  currency: string
  error_message: string | null
  sold_count: number | null
  sold_avg_price: number | null
  sold_min_price: number | null
  sold_max_price: number | null
}

export interface ChartDataPoint {
  date: string
  mercari_avg?: number
  mercari_min?: number
  mercari_max?: number
  mercari_count?: number
  mercari_sold_avg?: number
}
