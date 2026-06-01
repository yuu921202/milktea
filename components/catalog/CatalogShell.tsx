'use client'

import { useState, useMemo, useEffect } from 'react'
import { ProductCard } from './ProductCard'
import { QuickViewDrawer } from './QuickViewDrawer'
import type { Product } from '@/types/database'

type MarketPriceMap = Record<string, { avg_price: number | null; sold_avg_price: number | null } | undefined>
type SortKey = 'date' | 'name' | 'price'
type ShelfStyle = 'dark' | 'light' | 'plain'

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '⭐ 收藏' },
  { key: 'new', label: '全新' },
  { key: 'used', label: '二手' },
  { key: 'damaged', label: '損壞' },
]

// 3 fixed rows × 3 visible columns per row
// Products distributed column-by-column: item i → row (i % ROWS)
// When a row exceeds COLS items it scrolls horizontally
const ROWS = 3
const COLS = 3

const SHELF: Record<ShelfStyle, {
  frameColor: string
  framePad: string
  frameShadow: string
  cellBg: string
  cellShadow: string
  cellPad: string
  colGap: number
  boardH: number
  boardBg: string
  boardShadow: string
  bodyColor: string
  emptyTextColor: string
}> = {
  dark: {
    frameColor: '#2E1A08',
    framePad: '14px 10px 0',
    frameShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,200,140,0.08)',
    cellBg: '#3D2210',
    cellShadow: 'inset 0 4px 12px rgba(0,0,0,0.55), inset 0 -2px 6px rgba(0,0,0,0.3)',
    cellPad: '10px 8px 10px',
    colGap: 8,
    boardH: 22,
    boardBg: 'linear-gradient(180deg, #7A4520 0%, #5C3015 25%, #3A1D08 55%, #4A2812 80%, #6B3A1A 100%)',
    boardShadow: '0 6px 16px rgba(0,0,0,0.6)',
    bodyColor: '#2A1C0E',
    emptyTextColor: 'rgba(255,200,150,0.8)',
  },
  light: {
    frameColor: '#B8956E',
    framePad: '14px 10px 0',
    frameShadow: '0 8px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
    cellBg: '#F2E8D5',
    cellShadow: 'inset 0 3px 9px rgba(0,0,0,0.13), inset 0 -2px 5px rgba(0,0,0,0.07)',
    cellPad: '10px 8px 10px',
    colGap: 8,
    boardH: 22,
    boardBg: 'linear-gradient(180deg, #D4B896 0%, #C4A07A 25%, #A8835A 55%, #B8956E 80%, #D0AC82 100%)',
    boardShadow: '0 5px 13px rgba(0,0,0,0.32)',
    bodyColor: '#DDD5C4',
    emptyTextColor: '#6B4522',
  },
  plain: {
    frameColor: '#CBD5E1',
    framePad: '10px 12px 0',
    frameShadow: '0 10px 36px rgba(0,0,0,0.10), inset 3px 0 6px rgba(0,0,0,0.06), inset -3px 0 6px rgba(0,0,0,0.06)',
    cellBg: '#FFFFFF',
    cellShadow: 'inset 0 2px 8px rgba(0,0,0,0.07)',
    cellPad: '14px 6px 8px',
    colGap: 6,
    boardH: 16,
    boardBg: 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 30%, #94A3B8 55%, #A8B8C8 80%, #CBD5E1 100%)',
    boardShadow: '0 4px 10px rgba(0,0,0,0.12)',
    bodyColor: '',
    emptyTextColor: '#64748b',
  },
}

export function CatalogShell({
  products,
  latestPrices,
  horizontal = false,
  shelf = false,
  cabinetId,
  cabinetEmoji,
}: {
  products: Product[]
  latestPrices: MarketPriceMap
  horizontal?: boolean
  shelf?: boolean
  cabinetId?: string
  cabinetEmoji?: string
}) {
  const storageKey = cabinetId ? `shelf-style-${cabinetId}` : null

  const [shelfStyle, setShelfStyle] = useState<ShelfStyle>(() => {
    if (typeof window === 'undefined' || !storageKey) return 'light'
    return (localStorage.getItem(storageKey) as ShelfStyle) || 'light'
  })

  function handleStyleChange(s: ShelfStyle) {
    setShelfStyle(s)
    if (storageKey) localStorage.setItem(storageKey, s)
  }

  useEffect(() => {
    if (!shelf) return
    document.body.style.backgroundColor = SHELF[shelfStyle].bodyColor
    return () => { document.body.style.backgroundColor = '' }
  }, [shelf, shelfStyle])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('purin-favorites') ?? '[]')) }
    catch { return new Set() }
  })

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem('purin-favorites', JSON.stringify([...next]))
      return next
    })
  }

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'favorite') list = list.filter(p => favorites.has(p.id))
    else if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh-TW')
      if (sortKey === 'price') return (b.purchase_price ?? 0) - (a.purchase_price ?? 0)
      return (b.acquisition_date ?? b.created_at).localeCompare(a.acquisition_date ?? a.created_at)
    })
  }, [products, search, statusFilter, sortKey, favorites])

  // Distribute products column-by-column: item i → row (i % ROWS)
  // Row 0 gets items 0, 3, 6, 9...  Row 1 gets 1, 4, 7, 10...  Row 2 gets 2, 5, 8, 11...
  // Each row is padded to at least COLS cells so empty shelves have visible depth
  const rows = useMemo<(Product | null)[][]>(() => {
    if (!shelf) return []
    const r: (Product | null)[][] = Array.from({ length: ROWS }, () => [])
    filtered.forEach((p, i) => r[i % ROWS].push(p))
    r.forEach(row => { while (row.length < COLS) row.push(null) })
    return r
  }, [filtered, shelf])

  const cfg = SHELF[shelfStyle]

  return (
    <div>
      {/* Search + Sort */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="搜尋商品名稱或備註…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder:text-gray-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none"
            >×</button>
          )}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-sm border border-amber-200 rounded-lg px-2 py-2 bg-white text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="date">入手日期</option>
          <option value="name">名稱</option>
          <option value="price">入手價格</option>
        </select>
      </div>

      {/* Filter tabs + shelf style switcher */}
      <div className="flex gap-2 mb-4 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                statusFilter === tab.key
                  ? 'bg-amber-400 text-white font-semibold shadow-sm'
                  : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {(search || statusFilter !== 'all') && (
            <span className="text-xs text-amber-400 ml-1">{filtered.length} 件</span>
          )}
        </div>

        {shelf && (
          <div className="flex gap-1 flex-shrink-0">
            {([['dark', '🌰'], ['light', '🪵'], ['plain', '▦']] as [ShelfStyle, string][]).map(([s, icon]) => (
              <button
                key={s}
                onClick={() => handleStyleChange(s)}
                title={{ dark: '深色木紋', light: '淺色木紋', plain: '無木紋' }[s]}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  shelfStyle === s
                    ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                    : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Products ── */}
      {shelf ? (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: cfg.frameColor,
            padding: cfg.framePad,
            boxShadow: cfg.frameShadow,
          }}
        >
          {rows.map((rowItems, rowIdx) => (
            <div key={rowIdx}>
              {/*
                CSS grid with grid-auto-flow:column so items lay out left-to-right.
                grid-auto-columns sizes each track to exactly 1/COLS of the container,
                so 3 fit without scrolling; the 4th+ overflows → horizontal scroll.
                The frame background colour shows through the gap → acts as dividers.
              */}
              <div
                className="scrollbar-hide"
                style={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: `calc((100% - ${cfg.colGap * (COLS - 1)}px) / ${COLS})`,
                  gap: cfg.colGap,
                  overflowX: 'auto',
                  scrollSnapType: 'x mandatory',
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none',
                } as React.CSSProperties}
              >
                {rowItems.map((p, colIdx) => (
                  <div
                    key={p ? p.id : `e-${rowIdx}-${colIdx}`}
                    style={{
                      minHeight: 90,
                      backgroundColor: cfg.cellBg,
                      boxShadow: cfg.cellShadow,
                      padding: cfg.cellPad,
                      scrollSnapAlign: 'start',
                    }}
                  >
                    {p ? (
                      <ProductCard
                        product={p}
                        isFavorite={favorites.has(p.id)}
                        onToggleFavorite={toggleFavorite}
                        onSelect={setSelectedProduct}
                      />
                    ) : (
                      /* Empty state messages appear in center cell of middle row */
                      rowIdx === 1 && colIdx === 1 && products.length === 0 ? (
                        <div style={{
                          height: '100%', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: 6, color: cfg.emptyTextColor, padding: '12px 0',
                        }}>
                          {cabinetEmoji && <span style={{ fontSize: 34 }}>{cabinetEmoji}</span>}
                          <span style={{ fontSize: 14, fontWeight: 600 }}>還沒有收藏</span>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>點右下角 + 新增</span>
                        </div>
                      ) : rowIdx === 1 && colIdx === 1 && filtered.length === 0 ? (
                        <div style={{
                          height: '100%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          color: cfg.emptyTextColor, fontSize: 13, padding: '12px 0',
                        }}>
                          找不到符合的商品
                        </div>
                      ) : null
                    )}
                  </div>
                ))}
              </div>

              {/* Shelf board below each row */}
              <div style={{
                height: cfg.boardH,
                backgroundImage: cfg.boardBg,
                boxShadow: cfg.boardShadow,
              }} />
            </div>
          ))}
        </div>
      ) : horizontal ? (
        <div
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filtered.length === 0 ? (
            <div className="flex-1 text-center py-12 text-amber-400">找不到符合的商品</div>
          ) : filtered.map(p => (
            <div key={p.id} className="flex-shrink-0 w-36 sm:w-44">
              <ProductCard
                product={p}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={toggleFavorite}
                onSelect={setSelectedProduct}
              />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-amber-400">找不到符合的商品</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-stretch">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              isFavorite={favorites.has(p.id)}
              onToggleFavorite={toggleFavorite}
              onSelect={setSelectedProduct}
            />
          ))}
        </div>
      )}

      <QuickViewDrawer
        product={selectedProduct}
        marketPrice={selectedProduct ? latestPrices[selectedProduct.id] : null}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  )
}
