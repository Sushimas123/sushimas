"use client"
import Layout from "../components/Layout"
import { Package, Users, Building2, Settings, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
            <p className="text-gray-600">Overview sistem manajemen inventory dan produksi</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-800">1,234</p>
                </div>
                <Package className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Suppliers</p>
                  <p className="text-2xl font-bold text-gray-800">56</p>
                </div>
                <Users className="text-green-600" size={24} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Branches</p>
                  <p className="text-2xl font-bold text-gray-800">8</p>
                </div>
                <Building2 className="text-purple-600" size={24} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ready Stock Items</p>
                  <p className="text-2xl font-bold text-gray-800">892</p>
                </div>
                <TrendingUp className="text-orange-600" size={24} />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/product_name" className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                  <Package className="text-blue-600" size={20} />
                  <span className="text-sm font-medium text-gray-700">Manage Products</span>
                </Link>
                <Link href="/suppliers" className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                  <Users className="text-green-600" size={20} />
                  <span className="text-sm font-medium text-gray-700">Suppliers</span>
                </Link>
                <Link href="/ready" className="flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                  <TrendingUp className="text-orange-600" size={20} />
                  <span className="text-sm font-medium text-gray-700">Ready Stock</span>
                </Link>
                <Link href="/product_settings" className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                  <Settings className="text-purple-600" size={20} />
                  <span className="text-sm font-medium text-gray-700">Settings</span>
                </Link>
              </div>
              <div className="mt-4">
                <Link href="/analysis" className="flex items-center gap-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors w-full">
                  <TrendingUp className="text-indigo-600" size={20} />
                  <span className="text-sm font-medium text-gray-700">📊 Analysis Master View</span>
                </Link>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={16} />
                  <span className="text-sm text-gray-700">Database Connection</span>
                  <span className="ml-auto text-xs text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={16} />
                  <span className="text-sm text-gray-700">Import/Export Service</span>
                  <span className="ml-auto text-xs text-green-600 font-medium">Running</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-yellow-600" size={16} />
                  <span className="text-sm text-gray-700">Last Backup</span>
                  <span className="ml-auto text-xs text-gray-600">2 hours ago</span>
                </div>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-orange-600" size={16} />
                  <span className="text-sm text-gray-700">Low Stock Alerts</span>
                  <span className="ml-auto text-xs text-orange-600 font-medium">3 items</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm text-gray-700">New product "Bahan A" added to inventory</span>
                <span className="ml-auto text-xs text-gray-500">5 minutes ago</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm text-gray-700">Ready stock updated for 15 items</span>
                <span className="ml-auto text-xs text-gray-500">1 hour ago</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                <span className="text-sm text-gray-700">Supplier "PT ABC" information updated</span>
                <span className="ml-auto text-xs text-gray-500">3 hours ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
