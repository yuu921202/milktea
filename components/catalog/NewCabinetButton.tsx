'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCabinet } from '@/actions/products'

const EMOJIS = ['🐹', '🐰', '🐻', '🐼', '🐨', '🦊', '🐱', '🐶', '🦁', '🐸', '🐭', '🐯']
const COLORS = [
  { value: 'amber',   label: '琥珀', dot: 'bg-amber-400' },
  { value: 'rose',    label: '玫瑰', dot: 'bg-rose-400' },
  { value: 'sky',     label: '天藍', dot: 'bg-sky-400' },
  { value: 'emerald', label: '翠綠', dot: 'bg-emerald-400' },
  { value: 'violet',  label: '紫羅蘭', dot: 'bg-violet-400' },
  { value: 'orange',  label: '橘',   dot: 'bg-orange-400' },
]

export function NewCabinetButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🐹')
  const [color, setColor] = useState('amber')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function close() {
    setIsOpen(false)
    setName('')
    setEmoji('🐹')
    setColor('amber')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const fd = new FormData()
    fd.set('name', name.trim())
    fd.set('emoji', emoji)
    fd.set('color', color)
    startTransition(async () => {
      const result = await createCabinet(fd)
      if (!result?.error) {
        close()
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Trigger card */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-amber-200 rounded-2xl p-6 hover:border-amber-400 hover:bg-amber-50 transition-colors w-full min-h-[140px]"
      >
        <span className="text-4xl text-amber-300">+</span>
        <span className="text-sm text-amber-400 font-medium">新增展示櫃</span>
      </button>

      {!isOpen ? null : (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={close}
          />
          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-6 shadow-xl safe-area-bottom">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-amber-800 mb-5">新增展示櫃</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名字</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例：小明"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300 text-base"
                />
              </div>

              {/* Emoji */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">選擇 Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                        emoji === e
                          ? 'bg-amber-100 ring-2 ring-amber-400'
                          : 'bg-gray-50 hover:bg-amber-50'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">主題顏色</label>
                <div className="flex gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      className={`w-9 h-9 rounded-full ${c.dot} transition-transform ${
                        color === c.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-2xl">{emoji}</span>
                <span className="font-semibold text-gray-700">{name || '名字'} 的展示櫃</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pb-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isPending}
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl disabled:opacity-40 transition-colors"
                >
                  {isPending ? '建立中…' : '建立展示櫃'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  )
}
