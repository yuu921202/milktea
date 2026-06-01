'use server'

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function login(formData: FormData) {
  const password = formData.get('password') as string
  if (!password || password !== process.env.SITE_PASSWORD) {
    redirect('/login?error=密碼錯誤')
  }
  const session = await getIronSession<SessionData>(cookies(), sessionOptions)
  session.isLoggedIn = true
  await session.save()
  redirect('/catalog')
}

export async function logout() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions)
  session.destroy()
  redirect('/login')
}
