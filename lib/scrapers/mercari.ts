import type { ScrapeResult, ProductScrapeTarget } from './types'

const MERCARI_API = 'https://api.mercari.jp/v2/entities:search'
const JPY_TO_TWD = 0.209

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  try {
    const params = new URLSearchParams({
      'searchCondition.keyword': keyword,
      'searchCondition.status': 'STATUS_ON_SALE',
      'pageSize': '30',
    })

    const res = await fetch(`${MERCARI_API}?${params}`, {
      headers: {
        'X-Platform': 'web',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Origin': 'https://jp.mercari.com',
        'Referer': 'https://jp.mercari.com/',
      },
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      return [err(`Mercari API ${res.status}`)]
    }

    const data = await res.json()
    const items: Record<string, unknown>[] = data?.items ?? data?.result?.items ?? []

    if (!Array.isArray(items)) {
      return [err('Mercari API 回應格式異常')]
    }

    const prices: number[] = []
    for (const item of items) {
      const raw = item.price ?? item.sellingPrice
      const p = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
      if (!isNaN(p) && p > 0) {
        const twd = Math.round(p * JPY_TO_TWD)
        if (twd >= 50 && twd <= 500_000) prices.push(twd)
      }
    }

    if (prices.length === 0) {
      return [{
        success: true, platform: 'mercari', _alreadySaved: false,
        listing_count: 0, avg_price: null, min_price: null, max_price: null, currency: 'TWD',
      }]
    }

    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    return [{
      success: true,
      platform: 'mercari',
      _alreadySaved: false,
      listing_count: prices.length,
      avg_price: avg,
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      currency: 'TWD',
    }]
  } catch (e) {
    return [err(`Mercari 爬蟲失敗: ${String(e)}`)]
  }
}

function err(error: string): ScrapeResult {
  return {
    success: false, platform: 'mercari', _alreadySaved: false,
    listing_count: 0, avg_price: null, min_price: null, max_price: null, currency: 'TWD', error,
  }
}
