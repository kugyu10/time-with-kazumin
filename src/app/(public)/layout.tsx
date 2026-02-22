/**
 * Public Layout
 *
 * 認証不要のパブリックページ用レイアウト
 */

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50">
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-xl font-bold text-orange-600">
            Time with Kazumin
          </h1>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
