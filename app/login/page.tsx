import { login } from '@/actions/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm border border-amber-100">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐹</div>
          <h1 className="text-2xl font-bold text-amber-800">倉鼠幫</h1>
          <p className="text-sm text-amber-500 mt-1">請輸入密碼進入</p>
        </div>

        <form action={login} className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="輸入密碼"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 text-amber-900 placeholder-amber-300"
          />
          {searchParams.error && (
            <p className="text-red-500 text-sm text-center">{searchParams.error}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors"
          >
            進入
          </button>
        </form>
      </div>
    </div>
  )
}
