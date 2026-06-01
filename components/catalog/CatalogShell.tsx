'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProductCard } from './ProductCard'
import { QuickViewDrawer } from './QuickViewDrawer'
import { updateProductsOrder } from '@/actions/products'
import type { Product } from '@/types/database'

type MarketPriceMap = Record<string, { avg_price: number | null; sold_avg_price: number | null } | undefined>
type SortKey = 'custom' | 'date' | 'name' | 'price'
type ShelfStyle = 'dark' | 'light' | 'plain'

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '⭐ 收藏' },
  { key: 'new', label: '全新' },
  { key: 'used', label: '二手' },
  { key: 'damaged', label: '損壞' },
]

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

// Grip icon for drag handle
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="4" cy="2" r="1.2" />
      <circle cx="8" cy="2" r="1.2" />
      <circle cx="4" cy="6" r="1.2" />
      <circle cx="8" cy="6" r="1.2" />
      <circle cx="4" cy="10" r="1.2" />
      <circle cx="8" cy="10" r="1.2" />
    </svg>
  )
}

// Sortable cell for shelf layout
function SortableShelfCell({
  product,
  cfg,
  isDraggable,
  favorites,
  onToggleFavorite,
  onSelect,
  rowIdx,
  colIdx,
  showEmpty,
  cabinetEmoji,
  hasProducts,
  filteredEmpty,
  emptyTextColor,
}: {
  product: Product
  cfg: typeof SHELF[ShelfStyle]
  isDraggable: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onSelect: (p: Product) => void
  rowIdx: number
  colIdx: number
  showEmpty: boolean
  cabinetEmoji?: string
  hasProducts: boolean
  filteredEmpty: boolean
  emptyTextColor: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        position: 'relative',
        minHeight: 90,
        backgroundColor: cfg.cellBg,
        boxShadow: cfg.cellShadow,
        padding: cfg.cellPad,
        scrollSnapAlign: 'start',
      }}
      {...attributes}
    >
      {isDraggable && (
        <div
          {...listeners}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 20,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.18)',
            borderRadius: 5,
            cursor: 'grab',
            touchAction: 'none',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <GripIcon />
        </div>
      )}
      <ProductCard
        product={product}
        isFavorite={favorites.has(product.id)}
        onToggleFavorite={onToggleFavorite}
        onSelect={onSelect}
      />
    </div>
  )
}

// Sortable item for grid/horizontal layout
function SortableGridItem({
  product,
  isDraggable,
  favorites,
  onToggleFavorite,
  onSelect,
  className,
  style,
}: {
  product: Product
  isDraggable: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onSelect: (p: Product) => void
  className?: string
  style?: React.CSSProperties
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        position: 'relative',
      }}
      {...attributes}
    >
      {isDraggable && (
        <div
          {...listeners}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 20,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.18)',
            borderRadius: 5,
            cursor: 'grab',
            touchAction: 'none',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <GripIcon />
        </div>
      )}
      <ProductCard
        product={product}
        isFavorite={favorites.has(product.id)}
        onToggleFavorite={onToggleFavorite}
        onSelect={onSelect}
      />
    </div>
  )
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
  const [sortKey, setSortKey] = useState<SortKey>(() => shelf ? 'custom' : 'date')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('purin-favorites') ?? '[]')) }
    catch { return new Set() }
  })

  // Local products state — preserves drag order
  const [localProducts, setLocalProducts] = useState<Product[]>(products)

  // Sync when products prop changes (new product added / deleted)
  useEffect(() => {
    setLocalProducts(prev => {
      const newIds = new Set(products.map(p => p.id))
      const kept = prev.filter(p => newIds.has(p.id))
      const keptIds = new Set(kept.map(p => p.id))
      const added = products.filter(p => !keptIds.has(p.id))
      return [...kept, ...added]
    })
  }, [products])

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeProduct = activeId ? localProducts.find(p => p.id === activeId) ?? null : null

  const isDraggable = sortKey === 'custom' && !search.trim() && statusFilter === 'all'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem('purin-favorites', JSON.stringify(Array.from(next)))
      return next
    })
  }

  const filtered = useMemo(() => {
    let list = localProducts
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'favorite') list = list.filter(p => favorites.has(p.id))
    else if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)

    if (sortKey === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
    if (sortKey === 'price') return [...list].sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0))
    if (sortKey === 'date') return [...list].sort((a, b) =>
      (b.acquisition_date ?? b.created_at).localeCompare(a.acquisition_date ?? a.created_at)
    )
    return list // 'custom' — preserve localProducts order
  }, [localProducts, search, statusFilter, sortKey, favorites])

  const sortableIds = useMemo(() => filtered.map(p => p.id), [filtered])

  // Distribute products column-by-column into 3 rows for shelf view
  const rows = useMemo<(Product | null)[][]>(() => {
    if (!shelf) return []
    const r: (Product | null)[][] = Array.from({ length: ROWS }, () => [])
    filtered.forEach((p, i) => r[i % ROWS].push(p))
    r.forEach(row => { while (row.length < COLS) row.push(null) })
    return r
  }, [filtered, shelf])

  const cfg = SHELF[shelfStyle]

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIdx = localProducts.findIndex(p => p.id === active.id)
    const newIdx = localProducts.findIndex(p => p.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const newOrder = arrayMove(localProducts, oldIdx, newIdx)
    setLocalProducts(newOrder)
    updateProductsOrder(newOrder.map((p, i) => ({ id: p.id, sort_order: i })))
  }

  const dragOverlay = activeProduct ? (
    <div style={{
      opacity: 0.92,
      transform: 'scale(1.06) rotate(2deg)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
      borderRadius: 12,
      pointerEvents: 'none',
      width: 120,
    }}>
      <ProductCard product={activeProduct} isFavorite={favorites.has(activeProduct.id)} />
    </div>
  ) : null

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
          <option value="custom">自訂排序</option>
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

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDraggable && (
            <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              長按⠿可拖曳排序
            </span>
          )}

          {shelf && (
            <div className="flex gap-1">
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
      </div>

      {/* ── Products ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
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
                    {rowItems.map((p, colIdx) =>
                      p ? (
                        <SortableShelfCell
                          key={p.id}
                          product={p}
                          cfg={cfg}
                          isDraggable={isDraggable}
                          favorites={favorites}
                          onToggleFavorite={toggleFavorite}
                          onSelect={setSelectedProduct}
                          rowIdx={rowIdx}
                          colIdx={colIdx}
                          showEmpty={false}
                          cabinetEmoji={cabinetEmoji}
                          hasProducts={products.length > 0}
                          filteredEmpty={filtered.length === 0}
                          emptyTextColor={cfg.emptyTextColor}
                        />
                      ) : (
                        <div
                          key={`e-${rowIdx}-${colIdx}`}
                          style={{
                            minHeight: 90,
                            backgroundColor: cfg.cellBg,
                            boxShadow: cfg.cellShadow,
                            padding: cfg.cellPad,
                            scrollSnapAlign: 'start',
                          }}
                        >
                          {rowIdx === 1 && colIdx === 1 && products.length === 0 ? (
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
                          ) : null}
                        </div>
                      )
                    )}
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
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {filtered.length === 0 ? (
                <div className="flex-1 text-center py-12 text-amber-400">找不到符合的商品</div>
              ) : filtered.map(p => (
                <SortableGridItem
                  key={p.id}
                  product={p}
                  isDraggable={isDraggable}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelect={setSelectedProduct}
                  className="flex-shrink-0 w-36 sm:w-44"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-amber-400">找不到符合的商品</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-stretch">
              {filtered.map(p => (
                <SortableGridItem
                  key={p.id}
                  product={p}
                  isDraggable={isDraggable}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>
          )}
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {dragOverlay}
        </DragOverlay>
      </DndContext>

      <QuickViewDrawer
        product={selectedProduct}
        marketPrice={selectedProduct ? latestPrices[selectedProduct.id] : null}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  )
}
