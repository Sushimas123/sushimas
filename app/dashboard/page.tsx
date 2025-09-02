import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 p-4 border-r">
        <h2 className="text-lg font-bold mb-6">Sushimas</h2>
        <nav className="space-y-2">
          <Link href="/esb" className="block p-2 hover:bg-gray-200 rounded">
            Esb Report
          </Link>
          <Link href="/product_name" className="block p-2 hover:bg-gray-200 rounded">
            Product Name Report
          </Link>
          <Link href="/recipes" className="block p-2 hover:bg-gray-200 rounded">
            Recipes
          </Link>
          <Link href="/supplier" className="block p-2 hover:bg-gray-200 rounded">
            Supplier
          </Link>
          <Link href="/branches" className="block p-2 hover:bg-gray-200 rounded">
            Branches
          </Link>
          <Link href="/users" className="block p-2 hover:bg-gray-200 rounded">
            Users
          </Link>
        </nav>
      </aside>
    </div>
  )
}
