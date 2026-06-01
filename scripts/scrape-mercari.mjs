/**
 * Mercari 價格爬蟲（以圖搜圖 + 關鍵字備用）
 * 使用方法：
 *   node scripts/scrape-mercari.mjs                    # 所有商品
 *   node scripts/scrape-mercari.mjs --product-id=<id>  # 指定商品
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

// Read env from .env.local (fallback to process.env when called by API route)
let fileEnv = {}
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  fileEnv = Object.fromEntries(
    raw.split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
  )
} catch {}
const getEnv = k => fileEnv[k] ?? process.env[k] ?? ''

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

// Parse --product-id=<uuid> arg
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const eq = a.indexOf('=')
    return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true]
  })
)
const filterProductId = args['product-id'] ?? null

// ─── Download image to temp file ──────────────────────────────────────────────

async function downloadImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ext = url.match(/\.(png|webp|gif)/i) ? url.match(/\.(png|webp|gif)/i)[0] : '.jpg'
    const dest = join(tmpdir(), `mercari-img-${Date.now()}${ext}`)
    writeFileSync(dest, Buffer.from(buf))
    return dest
  } catch {
    return null
  }
}

// ─── Extract prices from current Mercari results page ─────────────────────────

async function extractPrices(page) {
  // Priority 1: intercept is set up before navigation — results accumulated in caller

  // Priority 2: TreeWalker — handles NT$ and ¥ text nodes
  const prices = await page.evaluate(() => {
    const found = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim() ?? ''
      const m = t.match(/^(?:NT\$|[¥￥])?([\d,]+)$/)
      if (m) {
        const v = parseInt(m[1].replace(/,/g, ''), 10)
        if (v >= 100 && v <= 500_000) found.push(v)
      }
    }
    return [...new Set(found)]
  })
  return prices
}

// ─── Dismiss Taiwan launch popup ─────────────────────────────────────────────

// Recursively search all shadow roots for an element matching predicate, click it
async function clickInShadowDOM(page, predicate) {
  return page.evaluate((pred) => {
    function clickIn(root) {
      for (const el of root.querySelectorAll('button, [role="button"], a')) {
        if (pred === 'popup' && (el.textContent.trim().includes('始める') || el.textContent.trim().includes('閉じる'))) {
          el.click(); return el.textContent.trim().slice(0, 30)
        }
        if (pred === 'imageSelect' && el.textContent.trim().includes('画像を選択')) {
          el.click(); return el.textContent.trim().slice(0, 30)
        }
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) { const r = clickIn(el.shadowRoot); if (r) return r }
      }
      return null
    }
    return clickIn(document.body)
  }, predicate).catch(() => null)
}

async function dismissPopup(page, waitMs = 5000) {
  // First try: Playwright getByRole (pierces open shadow DOM)
  try {
    const btn = page.getByRole('button', { name: '買い物を始める' })
    await btn.waitFor({ state: 'visible', timeout: waitMs })
    await btn.click()
    await page.waitForTimeout(800)
    console.log('    [popup] 已關閉台灣啟動彈窗')
    return
  } catch {}

  // Second try: deep shadow DOM traversal via evaluate
  const clicked = await clickInShadowDOM(page, 'popup')
  if (clicked) {
    await page.waitForTimeout(800)
    console.log(`    [popup] 已關閉彈窗（shadow DOM: "${clicked}"）`)
  }
  // NOTE: No Escape key here — it would close the image search panel
}

// ─── Image search on Mercari ──────────────────────────────────────────────────

async function doImageSearch(page, imagePath) {
  await page.goto('https://jp.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2000)

  // ── Dismiss popup first ──
  await dismissPopup(page)

  // ── Step 1: Click the camera icon to open the image search panel ──
  // aria-label="画像からさがす", also stable data-testid="image-search-button"
  const cameraLocators = [
    page.locator('[data-testid="image-search-button"] button'),
    page.getByLabel('画像からさがす'),
    page.getByRole('button', { name: '画像からさがす' }),
    page.locator('button[aria-label="画像からさがす"]'),
  ]

  let panelOpened = false
  for (const loc of cameraLocators) {
    try {
      const el = loc.first()
      if (await el.count() === 0) continue
      if (!await el.isVisible({ timeout: 1500 })) continue
      await el.click()
      panelOpened = true
      console.log('    [image search] 已點擊相機按鈕，等待面板出現…')
      break
    } catch {}
  }

  if (!panelOpened) return false

  // Some builds trigger filechooser directly on the camera button click
  const directChooser = await page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null)
  if (directChooser) {
    await directChooser.setFiles(imagePath)
    console.log('    [image search] 相機按鈕直接觸發檔案選擇，已上傳圖片')
    await page.waitForTimeout(8000)
    return true
  }

  // ── Step 2: Wait for panel, then click 「画像を選択する」 ──
  // Take screenshot to capture panel state (panel should be open now)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'scripts/mercari-panel-debug.png' })
  console.log('    [debug] 面板截圖已存至 scripts/mercari-panel-debug.png')

  // Wait for "画像を選択する" to appear, then click it
  // The button text is inside a <span> inside the <button> — use getByText on the span
  const step2Locators = [
    page.getByRole('button', { name: '画像を選択する' }),
    page.getByRole('button', { name: /画像を選択/i }),
    page.getByText('画像を選択する', { exact: true }),
    page.getByText(/画像を選択/i),
    page.locator('button:has-text("画像を選択する")'),
  ]
  for (const loc of step2Locators) {
    try {
      await loc.first().waitFor({ state: 'visible', timeout: 5000 })
      console.log('    [image search] 找到「画像を選択する」，準備點擊')
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        loc.first().click(),
      ])
      await fileChooser.setFiles(imagePath)
      console.log('    [image search] 已上傳圖片，等待結果出現（8 秒）…')
      await page.waitForTimeout(8000)

      // Try to find the "full results" link inside shadow DOM and navigate to it
      const searchUrl = await page.evaluate(() => {
        function findSearchLink(root) {
          for (const el of root.querySelectorAll('a')) {
            const h = el.href || ''
            if (h.includes('photoSearch') || h.includes('photo_search') ||
                (h.includes('jp.mercari.com/search') && h.includes('photo'))) {
              return h
            }
          }
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
              const r = findSearchLink(el.shadowRoot)
              if (r) return r
            }
          }
          return null
        }
        return findSearchLink(document.body)
      }).catch(() => null)

      if (searchUrl) {
        console.log(`    [image search] ✅ 找到完整結果頁連結，導航中…`)
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(5000)
        console.log(`    [image search] 結果頁 URL: ${page.url()}`)
      } else {
        console.log('    [image search] 未找到結果頁連結，從覆蓋層抓價格')
      }
      return true
    } catch {}
  }

  // Take a final screenshot to see what state the page is in
  await page.screenshot({ path: 'scripts/mercari-panel-fail.png' })
  console.log('    [debug] 找不到按鈕，失敗截圖存至 scripts/mercari-panel-fail.png')
  return false
}

// ─── Scrape one product ───────────────────────────────────────────────────────

async function scrapeMercariForProduct(page, product) {
  // Set up API intercept before any navigation
  const apiPrices = []
  const soldPrices = []
  const onResponse = async (response) => {
    try {
      const url = response.url()
      if (!url.includes('mercari')) return
      if (response.status() !== 200) return
      const ct = response.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return
      const data = await response.json()
      const items = data?.items ?? data?.result?.items ?? data?.data?.items ?? []
      for (const item of items) {
        const raw = item?.price ?? item?.sellingPrice
        const p = typeof raw === 'string' ? parseInt(raw, 10) : (typeof raw === 'number' ? raw : NaN)
        if (!isNaN(p) && p > 0) {
          if (item?.status === 'ITEM_STATUS_SOLD_OUT') {
            soldPrices.push(p)
          } else {
            apiPrices.push(p)
          }
        }
      }
    } catch {}
  }
  page.on('response', onResponse)

  let imagePath = null
  let usedImageSearch = false

  try {
    // ── Try image search first ──
    if (product.image_url) {
      console.log(`  ↓ 下載商品圖片…`)
      imagePath = await downloadImage(product.image_url)
      if (imagePath) {
        console.log(`  🔍 以圖搜圖`)
        usedImageSearch = await doImageSearch(page, imagePath)
        if (!usedImageSearch) {
          console.log(`    ⚠ 找不到圖片搜尋按鈕，改用關鍵字`)
        }
      } else {
        console.log(`    ⚠ 圖片下載失敗，改用關鍵字`)
      }
    }

    // ── Fall back to keyword search ──
    if (!usedImageSearch) {
      const keyword = product.search_keywords || product.name
      const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&status=on_sale`
      console.log(`  🔑 關鍵字搜尋: ${keyword}`)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(7000)
    }

    page.off('response', onResponse)

    const JPY_TO_TWD = 0.209

    let prices
    if (apiPrices.length > 0) {
      prices = apiPrices.map(p => Math.round(p * JPY_TO_TWD))
      console.log(`    [API intercept] 在售 ${apiPrices.length} 筆（JPY→TWD ×${JPY_TO_TWD}）`)
    } else {
      prices = await extractPrices(page)
      if (prices.length > 0) console.log(`    [TreeWalker] ${prices.length} 筆`)
    }
    prices = [...new Set(prices)].filter(p => p >= 100 && p <= 500_000).slice(0, 30)

    const soldConverted = [...new Set(soldPrices.map(p => Math.round(p * JPY_TO_TWD)))]
      .filter(p => p >= 100 && p <= 500_000).slice(0, 30)
    const soldAvg = soldConverted.length > 0
      ? Math.round(soldConverted.reduce((a, b) => a + b, 0) / soldConverted.length)
      : null
    if (soldConverted.length > 0) {
      console.log(`    [已售] ${soldConverted.length} 筆，均 NT$${soldAvg}，最低 NT$${Math.min(...soldConverted)}，最高 NT$${Math.max(...soldConverted)}`)
    }

    if (prices.length === 0) {
      await page.screenshot({ path: 'scripts/mercari-debug.png' })
      console.log(`    ⚠ 沒找到價格，截圖存至 scripts/mercari-debug.png`)
      return {
        listing_count: 0, avg_price: null, min_price: null, max_price: null,
        sold_count: soldConverted.length, sold_avg_price: soldAvg,
        sold_min_price: soldConverted.length > 0 ? Math.min(...soldConverted) : null,
        sold_max_price: soldConverted.length > 0 ? Math.max(...soldConverted) : null,
        error: '未找到商品',
      }
    }

    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    console.log(`    ✅ ${prices.length} 筆，均 NT$${avg}，最低 NT$${Math.min(...prices)}，最高 NT$${Math.max(...prices)}`)
    return {
      listing_count: prices.length, avg_price: avg, min_price: Math.min(...prices), max_price: Math.max(...prices),
      sold_count: soldConverted.length, sold_avg_price: soldAvg,
      sold_min_price: soldConverted.length > 0 ? Math.min(...soldConverted) : null,
      sold_max_price: soldConverted.length > 0 ? Math.max(...soldConverted) : null,
    }

  } catch (e) {
    page.off('response', onResponse)
    console.log(`    ❌ ${e.message}`)
    return {
      listing_count: 0, avg_price: null, min_price: null, max_price: null,
      sold_count: null, sold_avg_price: null, sold_min_price: null, sold_max_price: null,
      error: String(e),
    }
  } finally {
    if (imagePath && existsSync(imagePath)) unlinkSync(imagePath)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 啟動 Mercari 爬蟲（以圖搜圖模式）…\n')

  let query = supabase.from('products').select('id, name, search_keywords, image_url')
  if (filterProductId) {
    console.log(`   篩選 product_id: ${filterProductId}\n`)
    query = query.eq('id', filterProductId)
  }

  const { data: products } = await query
  if (!products?.length) { console.log('沒有商品'); process.exit(0) }

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    locale: 'ja-JP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // Warm up — also dismiss popup so it doesn't block later
  await page.goto('https://jp.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2000)
  await dismissPopup(page)

  for (const product of products) {
    console.log(`\n📦 ${product.name}${product.image_url ? ' 🖼' : ' (無圖)'}`)
    const result = await scrapeMercariForProduct(page, product)

    await supabase.from('price_history').insert({
      product_id: product.id,
      platform: 'mercari',
      listing_count: result.listing_count,
      avg_price: result.avg_price,
      min_price: result.min_price,
      max_price: result.max_price,
      currency: 'TWD',
      error_message: result.error ?? null,
      sold_count: result.sold_count ?? null,
      sold_avg_price: result.sold_avg_price ?? null,
      sold_min_price: result.sold_min_price ?? null,
      sold_max_price: result.sold_max_price ?? null,
    })

    process.stdout.write(
      `SCRAPE_RESULT_MERCARI:${JSON.stringify({ product_id: product.id, ...result })}\n`
    )

    await page.waitForTimeout(2000)
  }

  await browser.close()
  console.log('\n✅ 完成！')
}

main().catch(e => { console.error(e); process.exit(1) })
