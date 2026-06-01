import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '倉鼠幫',
  description: '我的倉鼠幫收藏目錄',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={`${inter.className} bg-amber-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
