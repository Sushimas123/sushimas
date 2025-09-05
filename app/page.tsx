"use client"
import Layout from "../components/Layout"
import { Package, Users, Building2, Settings, TrendingUp, AlertTriangle, CheckCircle, Clock, BarChart3, Eye, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <Layout>
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 InvenPro Dashboard</h1>
            <p className="text-gray-600">Inventory & Production Management System</p>
          </div>

          {/* Alert Banner for Suspicious Data */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-400 p-4 mb-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={20} />
                <div>
                  <h3 className="font-semibold text-red-800">⚠️ Data Mencurigakan Terdeteksi</h3>
                  <p className="text-sm text-red-700">7 produk dengan selisih di luar toleransi dalam 24 jam terakhir</p>
                </div>
              </div>
              <Link href="/analysis" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                <Eye size={16} />
                Lihat Detail
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">1,234</p>
                  <p className="text-xs text-green-600 mt-1">↗️ +12 this week</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Package className="text-blue-600" size={24} />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status OK</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">892</p>
                  <p className="text-xs text-gray-500 mt-1">72% dari total</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Perlu Perhatian</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">23</p>
                  <p className="text-xs text-orange-600 mt-1">⚠️ Selisih tinggi</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-lg">
                  <AlertTriangle className="text-orange-600" size={24} />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Branches</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">8</p>
                  <p className="text-xs text-gray-500 mt-1">All operational</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Building2 className="text-purple-600" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  🚀 Quick Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Link href="/product_name" className="group flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 hover:scale-105">
                    <div className="bg-blue-600 p-3 rounded-lg group-hover:bg-blue-700 transition-colors">
                      <Package className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Products</span>
                  </Link>
                  <Link href="/suppliers" className="group flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all duration-200 hover:scale-105">
                    <div className="bg-green-600 p-3 rounded-lg group-hover:bg-green-700 transition-colors">
                      <Users className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Suppliers</span>
                  </Link>
                  <Link href="/ready" className="group flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all duration-200 hover:scale-105">
                    <div className="bg-orange-600 p-3 rounded-lg group-hover:bg-orange-700 transition-colors">
                      <TrendingUp className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Ready Stock</span>
                  </Link>
                  <Link href="/product_settings" className="group flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 hover:scale-105">
                    <div className="bg-purple-600 p-3 rounded-lg group-hover:bg-purple-700 transition-colors">
                      <Settings className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Settings</span>
                  </Link>
                  <Link href="/analysis" className="group flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-xl transition-all duration-200 hover:scale-105 md:col-span-2">
                    <div className="bg-indigo-600 p-3 rounded-lg group-hover:bg-indigo-700 transition-colors">
                      <BarChart3 className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">📊 Analysis Master</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Suspicious Data Alert */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                🔍 Data Monitoring
              </h3>
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="text-red-600" size={18} />
                    <span className="font-semibold text-red-800">Selisih Tinggi</span>
                  </div>
                  <p className="text-sm text-red-700 mb-3">7 produk dengan selisih &gt; toleransi</p>
                  <Link href="/analysis" className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800">
                    Lihat Detail <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="text-yellow-600" size={18} />
                    <span className="font-semibold text-yellow-800">Stok Rendah</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-3">3 produk perlu restock</p>
                  <Link href="/ready" className="inline-flex items-center gap-2 text-sm font-medium text-yellow-700 hover:text-yellow-800">
                    Cek Stok <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="text-green-600" size={18} />
                    <span className="font-semibold text-green-800">System Status</span>
                  </div>
                  <p className="text-sm text-green-700">Semua sistem berjalan normal</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Analysis Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                📈 Recent Activity
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-gray-700 flex-1">Produk "Bahan A" ditambahkan</span>
                  <span className="text-xs text-gray-500">5m</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-gray-700 flex-1">Ready stock diperbarui (15 items)</span>
                  <span className="text-xs text-gray-500">1h</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                  <span className="text-sm text-gray-700 flex-1">⚠️ Selisih tinggi terdeteksi</span>
                  <span className="text-xs text-gray-500">2h</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  📊 Analysis Preview
                </h3>
                <Link href="/analysis" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                  View All <ArrowRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-red-600" size={16} />
                    <span className="text-sm font-medium text-red-800">Produk ABC</span>
                  </div>
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">Kurang</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-orange-600" size={16} />
                    <span className="text-sm font-medium text-orange-800">Produk XYZ</span>
                  </div>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">Lebih</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={16} />
                    <span className="text-sm font-medium text-green-800">Produk DEF</span>
                  </div>
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">OK</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
