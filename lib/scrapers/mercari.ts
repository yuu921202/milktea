import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'
import type { ScrapeResult, ProductScrapeTarget } from './types'

const JPY_TO_TWD = 0.209
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
// Remote Chromium binary for serverless (cached in /tmp after first download)
const CHROMIUM_REMOTE = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  // Fast path: try direct HTTP (no browser needed)
  const httpResult = await tryHttp(keyword)
  if (httpResult !== null) return httpResult

  // Slow path: real browser — handles DPoP auth automatically
  return tryBrowser(keyword)
}

// ── HTTP (lightweight) ────────────────────────────────────────────────────────

async function tryHttp(keyword: string): Promise<ScrapeResult[] | null> {
  const params = new URLSearchParams({
    'searchCondition.keyword': keyword,
    'searchCondition.status': 'STATUS_ON_SALE',
    'pageSize': '30',
  })
  const headers = {
    'X-Platform': 'web',
    'Accept': 'application/json',
    'User-Agent': UA,
    'Origin': 'https://jp.mercari.com',
    'Referer': 'https://jp.mercari.com/',
  }

  for (const ver of ['v1', 'v2'] as const) {
    try {
      const res = await fetch(`https://api.mercari.jp/${ver}/entities:search?${params}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const items: Record<string, unknown>[] = data?.items ?? data?.result?.items ?? []
      if (Array.isArray(items) && items.length > 0) return processItems(items)
    } catch { /* try next */ }
  }
  return null
}

// ── Browser (puppeteer-core + @sparticuz/chromium-min) ───────────────────────

async function tryBrowser(keyword: string): Promise<ScrapeResult[]> {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE),
      headless: 'shell' as Parameters<typeof puppeteer.launch>[0] extends { headless?: infer H } ? H : never,
    })

    const page = await browser.newPage()
    await page.setUserAgent(UA)

    // Collect all API response promises so we can await them after navigation
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
          } catch { /* ignore parse errors */ }
        })()
      )
    })

    await page.goto(
      `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&status=on_sale`,
      { waitUntil: 'networkidle2', timeout: 25_000 }
    )

    // Wait for all intercepted response handlers to finish
    await Promise.allSettled(pending)

    // Fallback: parse prices from DOM if API interception got nothing
    if (pricesJPY.length === 0) {
      const domPrices: number[] = await page.evaluate(() => {
        const results: number[] = []
        document.querySelectorAll('mer-price, [class*="price"]').forEach((el) => {
          const text = (el.textContent ?? '').replace(/[¥,\s]/g, '')
          const p = parseInt(text, 10)
          if (!isNaN(p) && p > 100) results.push(p)
        })
        return results
      })
      pricesJPY.push(...domPrices)
    }

    const twdPrices = pricesJPY
      .map((p) => Math.round(p * JPY_TO_TWD))
      .filter((p) => p >= 50 && p <= 500_000)

    return buildResult(twdPrices)
  } catch (e) {
    return [err(`Mercari 瀏覽器爬蟲失敗: ${String(e)}`)]
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
