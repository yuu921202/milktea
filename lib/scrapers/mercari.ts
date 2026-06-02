import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'
import type { ScrapeResult, ProductScrapeTarget } from './types'

const JPY_TO_TWD = 0.209
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROMIUM_REMOTE = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

const EMPTY_SOLD = { sold_count: null, sold_avg_price: null, sold_min_price: null, sold_max_price: null }

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  // Fast path: HTTP API (no browser)
  const httpResult = await tryHttp(keyword)
  if (httpResult !== null) return [httpResult]

  // Slow path: real browser — handles DPoP auth automatically
  return [await tryBrowser(keyword)]
}

// ── HTTP (lightweight) ────────────────────────────────────────────────────────

async function tryHttp(keyword: string): Promise<ScrapeResult | null> {
  const headers = {
    'X-Platform': 'web',
    'Accept': 'application/json',
    'User-Agent': UA,
    'Origin': 'https://jp.mercari.com',
    'Referer': 'https://jp.mercari.com/',
  }

  let onSaleItems: Record<string, unknown>[] | null = null
  let soldItems: Record<string, unknown>[] | null = null

  for (const ver of ['v1', 'v2'] as const) {
    try {
      const [onSaleRes, soldRes] = await Promise.all([
        fetch(`https://api.mercari.jp/${ver}/entities:search?${new URLSearchParams({
          'searchCondition.keyword': keyword,
          'searchCondition.status': 'STATUS_ON_SALE',
          'pageSize': '30',
        })}`, { headers, signal: AbortSignal.timeout(12_000) }),
        fetch(`https://api.mercari.jp/${ver}/entities:search?${new URLSearchParams({
          'searchCondition.keyword': keyword,
          'searchCondition.status': 'STATUS_SOLD_OUT',
          'pageSize': '30',
        })}`, { headers, signal: AbortSignal.timeout(12_000) }),
      ])

      if (onSaleRes.ok) {
        const d = await onSaleRes.json()
        const items = d?.items ?? d?.result?.items ?? []
        if (Array.isArray(items) && items.length > 0) onSaleItems = items
      }
      if (soldRes.ok) {
        const d = await soldRes.json()
        const items = d?.items ?? d?.result?.items ?? []
        if (Array.isArray(items) && items.length > 0) soldItems = items
      }

      if (onSaleItems !== null || soldItems !== null) break
    } catch { /* try next version */ }
  }

  if (onSaleItems === null && soldItems === null) return null

  return buildResult(
    extractPrices(onSaleItems ?? []),
    extractPrices(soldItems ?? []),
  )
}

// ── Browser (puppeteer-core + @sparticuz/chromium-min) ───────────────────────

async function tryBrowser(keyword: string): Promise<ScrapeResult> {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE),
      headless: 'shell' as Parameters<typeof puppeteer.launch>[0] extends { headless?: infer H } ? H : never,
    })

    // Run both searches in parallel with separate pages
    const [onSalePrices, soldPrices] = await Promise.all([
      interceptPrices(browser, keyword, 'on_sale'),
      interceptPrices(browser, keyword, 'sold_out'),
    ])

    return buildResult(onSalePrices, soldPrices)
  } catch (e) {
    return err(`Mercari 瀏覽器爬蟲失敗: ${String(e)}`)
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}

async function interceptPrices(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  keyword: string,
  status: 'on_sale' | 'sold_out',
): Promise<number[]> {
  const page = await browser.newPage()
  await page.setUserAgent(UA)

  const pricesJPY: number[] = []
  const pending: Promise<void>[] = []

  page.on('response', (response) => {
    const url = response.url()
    if (!url.includes('api.mercari.jp')) return
    if (!url.includes('search') && !url.includes('entities')) return

    pending.push(
      (async () => {
        try {
          const ct = response.headers()['content-type'] ?? ''
          if (!ct.includes('json')) return
          const data = await response.json()
          const items: Record<string, unknown>[] = data?.items ?? data?.result?.items ?? []
          if (!Array.isArray(items)) return
          for (const item of items) {
            const raw = item.price ?? item.sellingPrice
            const p = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
            if (!isNaN(p) && p > 0) pricesJPY.push(p)
          }
        } catch { /* ignore */ }
      })()
    )
  })

  try {
    await page.goto(
      `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&status=${status}`,
      { waitUntil: 'networkidle2', timeout: 22_000 }
    )
    await Promise.allSettled(pending)
  } catch { /* timeout or navigation error — use what we have */ }

  await page.close()
  return pricesJPY
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPrices(items: Record<string, unknown>[]): number[] {
  const prices: number[] = []
  for (const item of items) {
    const raw = item.price ?? item.sellingPrice
    const p = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
    if (!isNaN(p) && p > 0) prices.push(p)
  }
  return prices
}

function buildResult(onSalePricesJPY: number[], soldPricesJPY: number[]): ScrapeResult {
  const onSaleTWD = onSalePricesJPY
    .map(p => Math.round(p * JPY_TO_TWD))
    .filter(p => p >= 50 && p <= 500_000)

  const soldTWD = soldPricesJPY
    .map(p => Math.round(p * JPY_TO_TWD))
    .filter(p => p >= 50 && p <= 500_000)

  const onSaleStats = stats(onSaleTWD)
  const soldStats = stats(soldTWD)

  return {
    success: true,
    platform: 'mercari',
    _alreadySaved: false,
    currency: 'TWD',
    listing_count: onSaleTWD.length,
    avg_price: onSaleStats.avg,
    min_price: onSaleStats.min,
    max_price: onSaleStats.max,
    sold_count: soldTWD.length > 0 ? soldTWD.length : null,
    sold_avg_price: soldStats.avg,
    sold_min_price: soldStats.min,
    sold_max_price: soldStats.max,
  }
}

function stats(prices: number[]): { avg: number | null; min: number | null; max: number | null } {
  if (prices.length === 0) return { avg: null, min: null, max: null }
  return {
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    min: Math.min(...prices),
    max: Math.max(...prices),
  }
}

function err(error: string): ScrapeResult {
  return {
    success: false, platform: 'mercari', _alreadySaved: false, currency: 'TWD',
    listing_count: 0, avg_price: null, min_price: null, max_price: null,
    ...EMPTY_SOLD,
    error,
  }
}
