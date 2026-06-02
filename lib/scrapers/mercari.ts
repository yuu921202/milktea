import type { ScrapeResult, ProductScrapeTarget } from './types'

const JPY_TO_TWD = 0.209

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  try {
    const searchUrl = `https://jp.mercari.com/search?${new URLSearchParams({
      keyword,
      status: 'on_sale',
    })}`

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) return [err(`Mercari HTTP ${res.status}`)]

    const html = await res.text()

    // Extract __NEXT_DATA__ (Mercari JP uses Next.js SSR)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const items = findItems(nextData)
        if (items && items.length > 0) return processItems(items)
      } catch {
        // fall through to regex fallback
      }
    }

    // Fallback: regex-extract "price":"1234" patterns from the raw HTML
    return extractPricesFromHtml(html)
  } catch (e) {
    return [err(`Mercari 爬蟲失敗: ${String(e)}`)]
  }
}

function findItems(data: unknown): Record<string, unknown>[] | null {
  if (!data || typeof data !== 'object') return null

  // Try common Next.js pageProps paths Mercari has used
  const paths = [
    ['props', 'pageProps', 'initialData', 'result', 'items'],
    ['props', 'pageProps', 'initialData', 'items'],
    ['props', 'pageProps', 'searchResult', 'items'],
    ['props', 'pageProps', 'items'],
    ['props', 'pageProps', 'data', 'items'],
  ]

  for (const path of paths) {
    let cur: unknown = data
    for (const key of path) {
      if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key]
      } else {
        cur = undefined
        break
      }
    }
    if (Array.isArray(cur) && cur.length > 0) return cur as Record<string, unknown>[]
  }

  return null
}

function extractPricesFromHtml(html: string): ScrapeResult[] {
  const prices: number[] = []
  // Match "price":"1234" or "price":1234 patterns in JSON blobs
  for (const m of html.matchAll(/"price"\s*:\s*"?(\d+)"?/g)) {
    const p = parseInt(m[1], 10)
    if (p > 0) {
      const twd = Math.round(p * JPY_TO_TWD)
      if (twd >= 50 && twd <= 500_000) prices.push(twd)
    }
  }
  if (prices.length === 0) return [err('Mercari 頁面找不到商品價格（可能被封鎖）')]
  return buildResult(prices)
}

function processItems(items: Record<string, unknown>[]): ScrapeResult[] {
  const prices: number[] = []
  for (const item of items) {
    const raw = item.price ?? item.sellingPrice
    const p = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
    if (!isNaN(p) && p > 0) {
      const twd = Math.round(p * JPY_TO_TWD)
      if (twd >= 50 && twd <= 500_000) prices.push(twd)
    }
  }
  return buildResult(prices)
}

function buildResult(prices: number[]): ScrapeResult[] {
  if (prices.length === 0) {
    return [{ success: true, platform: 'mercari', _alreadySaved: false, listing_count: 0, avg_price: null, min_price: null, max_price: null, currency: 'TWD' }]
  }
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  return [{
    success: true, platform: 'mercari', _alreadySaved: false,
    listing_count: prices.length,
    avg_price: avg,
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    currency: 'TWD',
  }]
}

function err(error: string): ScrapeResult {
  return { success: false, platform: 'mercari', _alreadySaved: false, listing_count: 0, avg_price: null, min_price: null, max_price: null, currency: 'TWD', error }
}
