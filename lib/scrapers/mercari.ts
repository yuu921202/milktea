import { spawn } from 'child_process'
import { resolve } from 'path'
import type { ScrapeResult, ProductScrapeTarget } from './types'

export async function scrapeWithPlaywright(product: ProductScrapeTarget): Promise<ScrapeResult[]> {
  const scriptPath = resolve(process.cwd(), 'scripts/scrape-mercari.mjs')

  return new Promise((done) => {
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn('node', [scriptPath, `--product-id=${product.id}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: process.cwd(),
      })
    } catch (e) {
      done([err(`無法啟動爬蟲: ${String(e)}`)])
      return
    }

    let stdout = ''

    const timer = setTimeout(() => {
      proc.kill()
      done([err('Mercari 爬蟲逾時（55 秒）')])
    }, 55_000)

    proc.stdout!.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr!.on('data', () => {})

    proc.on('close', () => {
      clearTimeout(timer)

      const line = stdout.split('\n').find(l => l.startsWith('SCRAPE_RESULT_MERCARI:'))
      if (line) {
        try {
          const r = JSON.parse(line.slice('SCRAPE_RESULT_MERCARI:'.length))
          done([{
            success: !r.error,
            platform: 'mercari',
            _alreadySaved: true,
            listing_count: r.listing_count ?? 0,
            avg_price: r.avg_price ?? null,
            min_price: r.min_price ?? null,
            max_price: r.max_price ?? null,
            currency: 'TWD',
            error: r.error ?? undefined,
          }])
          return
        } catch {}
      }

      done([err('未收到爬蟲結果')])
    })

    proc.on('error', (e: Error) => {
      clearTimeout(timer)
      done([err(`無法執行爬蟲: ${e.message}`)])
    })
  })
}

function err(error: string): ScrapeResult {
  return { success: false, platform: 'mercari', _alreadySaved: false, listing_count: 0, avg_price: null, min_price: null, max_price: null, currency: 'TWD', error }
}
