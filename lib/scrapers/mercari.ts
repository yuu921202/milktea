import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'
import type { ScrapeResult, ProductScrapeTarget } from './types'

const JPY_TO_TWD = 0.209
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROMIUM_REMOTE = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

const NULL_SOLD = { sold_count: null, sold_avg_price: null, sold_min_price: null, sold_max_price: null }

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const keyword = product.search_keywords || product.name

  // Fast path: HTTP API (no browser needed)
  const httpResult = await tryHttp(keyword)
  if (httpResult !== null) return [httpResult]

  // Slow path: real browser
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

      let onSaleItems: Record<string, unknown>[] = []
      let soldItems: Record<string, unknown>[] = []

      if (onSaleRes.ok) {
        const d = await onSaleRes.json()
        onSaleItems = Array.isArray(d?.items ?? d?.result?.items) ? (d?.items ?? d?.result?.items) : []
      }
      if (soldRes.ok) {
        const d = await soldRes.json()
        soldItems = Array.isArray(d?.items ?? d?.result?.items) ? (d?.items ?? d?.result?.items) : []
      }

      if (onSaleItems.length > 0 || soldItems.length > 0) {
        return buildResult(extractJPY(onSaleItems), extractJPY(soldItems))
      }
    } catch { /* try next version */ }
  }
  return null
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

    // Run sequentially (not parallel) to avoid Vercel memory pressure
    const onSalePrices = await scrapePage(browser, keyword, 'on_sale')
    const soldPrices = await scrapePage(browser, keyword, 'sold_out')

    return buildResult(onSalePrices, soldPrices)
  } catch (e) {
    return errResult(`Mercari 瀏覽器爬蟲失敗: ${String(e)}`)
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}

async function scrapePage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  keyword: string,
  status: 'on_sale' | 'sold_out',
): Promise<number[]> {
  const page = await browser.newPage()
  await page.setUserAgent(UA)

  const intercepted: number[] = []
  const pending: Promise<void>[] = []

  // Strategy 1: intercept the client-side API calls Mercari makes after hydration
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
            if (!isNaN(p) && p > 0) intercepted.push(p)
          }
        } catch { /* ignore */ }
      })()
    )
  })

  try {
    await page.goto(
      `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&status=${status}`,
      { waitUntil: 'domcontentloaded', timeout: 20_000 }
    )

    // Wait up to 8s for API responses to arrive after hydration
    await waitForCondition(() => intercepted.length > 0, 8_000)
    await Promise.allSettled(pending)
  } catch { /* timeout — use what we have */ }

  // Strategy 2: read __NEXT_DATA__ embedded in the page (SSR data)
  if (intercepted.length === 0) {
    const fromNextData = await page.evaluate((): number[] => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nd = (window as any).__NEXT_DATA__
        if (!nd) return []
        const pp = nd?.props?.pageProps
        const items: Record<string, unknown>[] =
          pp?.initialData?.result?.items ??
          pp?.initialData?.items ??
          pp?.searchResult?.items ??
          pp?.items ?? []
        if (!Array.isArray(items)) return []
        return items.flatMap((item: Record<string, unknown>) => {
          const raw = item.price ?? item.sellingPrice
          const p = typeof raw === 'string' ? parseInt(raw as string, 10) : typeof raw === 'number' ? raw : NaN
          return isNaN(p) || p <= 0 ? [] : [p]
        })
      } catch { return [] }
    })
    intercepted.push(...fromNextData)
  }

  await page.close()
  return intercepted
}

// Wait until condition is true or timeout expires
function waitForCondition(cond: () => boolean, ms: number): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now()
    const tick = () => {
      if (cond() || Date.now() - start >= ms) resolve()
      else setTimeout(tick, 200)
    }
    tick()
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJPY(items: Record<string, unknown>[]): number[] {
  return items.flatMap(item => {
    const raw = item.price ?? item.sellingPrice
    const p = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
    return isNaN(p) || p <= 0 ? [] : [p]
  })
}

function buildResult(onSaleJPY: number[], soldJPY: number[]): ScrapeResult {
  const onSaleTWD = toTWD(onSaleJPY)
  const soldTWD = toTWD(soldJPY)
  const onS = calcStats(onSaleTWD)
  const sold = calcStats(soldTWD)

  return {
    success: true,
    platform: 'mercari',
    _alreadySaved: false,
    currency: 'TWD',
    listing_count: onSaleTWD.length,
    avg_price: onS.avg,
    min_price: onS.min,
    max_price: onS.max,
    sold_count: soldTWD.length > 0 ? soldTWD.length : null,
    sold_avg_price: sold.avg,
    sold_min_price: sold.min,
    sold_max_price: sold.max,
  }
}

function toTWD(jpyPrices: number[]): number[] {
  return jpyPrices
    .map(p => Math.round(p * JPY_TO_TWD))
    .filter(p => p >= 50 && p <= 500_000)
}

function calcStats(prices: number[]): { avg: number | null; min: number | null; max: number | null } {
  if (prices.length === 0) return { avg: null, min: null, max: null }
  return {
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    min: Math.min(...prices),
    max: Math.max(...prices),
  }
}

function errResult(error: string): ScrapeResult {
  return {
    success: false, platform: 'mercari', _alreadySaved: false, currency: 'TWD',
    listing_count: 0, avg_price: null, min_price: null, max_price: null,
    ...NULL_SOLD, error,
  }
}
