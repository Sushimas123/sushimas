import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 p-4 border-r">
        <h2 className="text-lg font-bold mb-6">Sushimas</h2>
        <nav className="space-y-2">
          <Link href="/esb" className="block p-2 hover:bg-gray-200 rounded">
            ESB
          </Link>
        </nav>
      </aside>
    </div>
  )
}
