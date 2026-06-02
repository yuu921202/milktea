import type { ScrapeResult, ProductScrapeTarget } from './types'

const JPY_TO_TWD = 0.209
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const COMMON_HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'ja-JP,ja;q=0.9',
  'Origin': 'https://jp.mercari.com',
  'Referer': 'https://jp.mercari.com/',
}

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  // Try v1 API (older endpoint, no DPoP required)
  const v1 = await tryApiEndpoint('v1', keyword)
  if (v1 !== null) return v1

  // Try v2 API (newer, might fail with 401)
  const v2 = await tryApiEndpoint('v2', keyword)
  if (v2 !== null) return v2

  // Fallback: scrape search page HTML
  return scrapeHtml(keyword)
}

async function tryApiEndpoint(version: 'v1' | 'v2', keyword: string): Promise<ScrapeResult[] | null> {
  try {
    const params = new URLSearchParams({
      'searchCondition.keyword': keyword,
      'searchCondition.status': 'STATUS_ON_SALE',
      'pageSize': '30',
    })
    const res = await fetch(`https://api.mercari.jp/${version}/entities:search?${params}`, {
      headers: {
        ...COMMON_HEADERS,
        'X-Platform': 'web',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const items: Record<string, unknown>[] = data?.items ?? data?.result?.items ?? []
    if (!Array.isArray(items) || items.length === 0) return null
    return processItems(items)
  } catch {
    return null
  }
}

async function scrapeHtml(keyword: string): Promise<ScrapeResult[]> {
  try {
    const url = `https://jp.mercari.com/search?${new URLSearchParams({ keyword, status: 'on_sale' })}`
    const res = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return [err(`Mercari HTTP ${res.status}`)]

    const html = await res.text()

    // Try __NEXT_DATA__ (Next.js SSR data)
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (match) {
      try {
        const nextData = JSON.parse(match[1])
        const items = findItems(nextData)
        if (items && items.length > 0) return processItems(items)
      } catch { /* fall through */ }
    }

    // Regex fallback: look for "price":"1234" patterns
    const prices: number[] = []
    const re = /"price"\s*:\s*"?(\d+)"?/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const p = parseInt(m[1], 10)
      if (p > 0) {
        const twd = Math.round(p * JPY_TO_TWD)
        if (twd >= 50 && twd <= 500_000) prices.push(twd)
      }
    }
    if (prices.length > 0) return buildResult(prices)

    // Diagnostic: show first 80 chars of response to help debug
    const snippet = html.slice(0, 80).replace(/[\r\n\s]+/g, ' ').trim()
    return [err(`Mercari 頁面無資料（${snippet}）`)]
  } catch (e) {
    return [err(`Mercari 爬蟲失敗: ${String(e)}`)]
  }
}

function findItems(data: unknown): Record<string, unknown>[] | null {
  if (!data || typeof data !== 'object') return null
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
      } else { cur = undefined; break }
    }
    if (Array.isArray(cur) && cur.length > 0) return cur as Record<string, unknown>[]
  }
  return null
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
