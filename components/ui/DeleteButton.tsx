'use client'

import { useTransition } from 'react'

export function DeleteButton({
  productName,
  action,
  iconOnly,
}: {
  productName: string
  action: () => Promise<void>
  iconOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`確定要刪除「${productName}」嗎？此操作無法復原。`)) return
    startTransition(() => action())
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        title="刪除"
        className="p-2 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="text-sm px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
    >
      {pending ? '刪除中...' : '刪除'}
    </button>
  )
}
