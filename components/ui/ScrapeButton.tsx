'use client'

import { useState } from 'react'

export function ScrapeButton({
  productId,
  productName,
  iconOnly,
}: {
  productId?: string
  productName?: string
  iconOnly?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [summary, setSummary] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState('')

  async function handleScrape() {
    setStatus('loading')
    setSummary({})
    setErrorMsg('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productId ? { productId } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '爬蟲失敗')
      setStatus('done')
      setSummary(data.summary ?? {})
    } catch (e) {
      setStatus('error')
      setErrorMsg(String(e))
    }
  }

  if (iconOnly) {
    const title =
      status === 'loading' ? '抓取中…' :
      status === 'done' ? '已更新' :
      status === 'error' ? '失敗，點擊重試' :
      '更新市場價格'

    return (
      <button
        type="button"
        disabled={status === 'loading'}
        onClick={handleScrape}
        title={title}
        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
          status === 'done' ? 'text-green-500 hover:bg-green-50' :
          status === 'error' ? 'text-red-400 hover:bg-red-50' :
          'text-blue-400 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        {status === 'loading' ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : status === 'done' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={handleScrape}
          className="text-sm px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? '抓取中...' : productId ? '更新價格' : '全部更新'}
        </button>
      </div>
      {status === 'error' && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
      {status === 'done' && Object.keys(summary).length > 0 && (
        <div className="text-xs space-y-0.5">
          {Object.entries(summary).map(([platform, msg]) => {
            const isOk = !msg.includes('失敗') && !msg.includes('過期') && !msg.includes('請')
            return (
              <div key={platform} className={isOk ? 'text-green-600' : 'text-amber-600'}>
                <span className="font-medium">{platform === 'mercari' ? 'Mercari' : '鹹魚'}：</span>
                {msg}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
