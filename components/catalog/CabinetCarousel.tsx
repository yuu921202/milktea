'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { NewCabinetButton } from './NewCabinetButton'
import type { Cabinet } from '@/types/database'

export type ProductPreview = {
  id: string
  name: string
  image_url: string | null
}

const ACCENT = {
  amber:   { bar: 'bg-amber-400',   text: 'text-amber-700',   count: 'bg-amber-100 text-amber-600' },
  rose:    { bar: 'bg-rose-400',    text: 'text-rose-700',    count: 'bg-rose-100 text-rose-600' },
  sky:     { bar: 'bg-sky-400',     text: 'text-sky-700',     count: 'bg-sky-100 text-sky-600' },
  emerald: { bar: 'bg-emerald-400', text: 'text-emerald-700', count: 'bg-emerald-100 text-emerald-600' },
  violet:  { bar: 'bg-violet-400',  text: 'text-violet-700',  count: 'bg-violet-100 text-violet-600' },
  orange:  { bar: 'bg-orange-400',  text: 'text-orange-700',  count: 'bg-orange-100 text-orange-600' },
} as const

type AccentKey = keyof typeof ACCENT

export function CabinetCarousel({
  cabinets,
  grouped,
}: {
  cabinets: Cabinet[]
  grouped: Record<string, ProductPreview[]>
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cabinets
    return cabinets.filter(c => c.name.toLowerCase().includes(q))
  }, [cabinets, search])

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="搜尋展示櫃名稱…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-amber-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder:text-gray-300"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* No result */}
      {filtered.length === 0 && search && (
        <p className="text-sm text-amber-400 py-4 text-center">找不到「{search}」的展示櫃</p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map(cabinet => {
          const items = grouped[cabinet.id] ?? []
          const previews = items.slice(0, 4)
          const a = ACCENT[(cabinet.color as AccentKey)] ?? ACCENT.amber

          return (
            <Link
              key={cabinet.id}
              href={`/cabinet/${cabinet.id}`}
              className="block bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={`${a.bar} h-1.5`} />
              <div className="p-4">
                {/* Title */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl flex-shrink-0">{cabinet.emoji}</span>
                    <span className={`font-bold text-base truncate ${a.text}`}>
                      {cabinet.name} 的展示櫃
                    </span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 ml-2 ${a.count}`}>
                    {items.length} 件
                  </span>
                </div>

                {/* Preview images */}
                {previews.length > 0 ? (
                  <div className="flex gap-2">
                    {previews.map(p => (
                      <div
                        key={p.id}
                        className="relative w-14 h-14 rounded-lg overflow-hidden bg-amber-50 flex-shrink-0"
                      >
                        {p.image_url ? (
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">🐹</div>
                        )}
                      </div>
                    ))}
                    {items.length > 4 && (
                      <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-amber-400 font-semibold">+{items.length - 4}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 italic">還沒有收藏</p>
                )}
              </div>
            </Link>
          )
        })}

        {/* Add new cabinet */}
        <NewCabinetButton />
      </div>
    </div>
  )
}
