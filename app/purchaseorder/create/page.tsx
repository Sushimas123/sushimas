"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { Plus, ShoppingCart, Search, Calendar, Building2, User, Package, Minus, Save, ArrowLeft } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface Supplier {
  id_supplier: number
  nama_supplier: string
  nomor_rekening?: string
  bank_penerima?: string
  nama_penerima?: string
  termin_tempo?: number
  estimasi_pengiriman?: number
  divisi?: string
  nama_barang?: string
  merk?: string
}

interface Branch {
  id_branch: number
  nama_branch: string
}

interface Product {
  id_product: number
  product_name: string
  category: string
  sub_category: string
  unit_kecil: string
  unit_besar: string
  satuan_kecil: number
  satuan_besar: number
  harga: number
  merk: string
  stock_qty?: number
  id_supplier?: number
}

interface POItem {
  product_id: number
  product_name: string
  qty: number
  unit: string
  unit_besar: string
  satuan_besar: number
  keterangan: string
  supplier_name: string
  merk: string
}

function CreatePurchaseOrder() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [uniqueSuppliers, setUniqueSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productSuppliers, setProductSuppliers] = useState<{product: Product, suppliers: Supplier[]}[]>([])
  const [loading, setLoading] = useState(true)
  const [searchProduct, setSearchProduct] = useState('')
  const [poItems, setPOItems] = useState<POItem[]>([])
  const [selectedProductSupplier, setSelectedProductSupplier] = useState<{product: Product, supplier: Supplier} | null>(null)
  const [userRole, setUserRole] = useState('')
  const [userBranch, setUserBranch] = useState('')
  const [allowedBranches, setAllowedBranches] = useState<string[]>([])
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false)
  const [formData, setFormData] = useState({
    supplier_id: '',
    cabang_id: '',
    po_date: new Date().toISOString().split('T')[0],
    termin_days: 30,
    notes: '',
    priority: 'biasa',
    status: 'belum di order',
    keterangan: ''
  })

  useEffect(() => {
    initializeUserData()
  }, [])
  
  useEffect(() => {
    if (isUserDataLoaded) {
      console.log('User data loaded, fetching branches and suppliers')
      fetchBranches()
      fetchSuppliers()
    }
  }, [isUserDataLoaded, allowedBranches])
  
  useEffect(() => {
    // Check for prefill data from stock alert
    const prefillData = localStorage.getItem('po_prefill')
    if (prefillData) {
      try {
        const data = JSON.parse(prefillData)
        handleStockAlertPrefill(data)
        localStorage.removeItem('po_prefill')
      } catch (error) {
        console.error('Error parsing prefill data:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (suppliers.length > 0) {
      fetchAllProducts()
    }
  }, [suppliers])

  useEffect(() => {
    if (searchProduct.length >= 2) {
      searchProductsWithSuppliers()
    } else {
      setProductSuppliers([])
    }
  }, [searchProduct, allProducts, suppliers])

  const initializeUserData = async () => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        console.log('User data:', user)
        setUserRole(user.role || '')
        
        let userAllowedBranches: string[] = []
        
        // Set allowed branches based on role first
        if (user.role === 'super admin' || user.role === 'admin') {
          console.log('User is admin/super admin - all branches allowed')
          userAllowedBranches = [] // Empty array means all branches are allowed
        } else {
          // For non-admin users, check user_branches table first
          if (user.id_user) {
            console.log('Checking user_branches table for user:', user.id_user)
            const { data: userBranches } = await supabase
              .from('user_branches')
              .select('kode_branch, branches!inner(nama_branch)')
              .eq('id_user', user.id_user)
              .eq('is_active', true)
            
            if (userBranches && userBranches.length > 0) {
              const branchNames = userBranches.map(ub => (ub.branches as any).nama_branch)
              userAllowedBranches = branchNames
              console.log('Found branches from user_branches:', branchNames)
            } else {
              // Fallback 1: check if user is PIC of any branch
              console.log('No user_branches found, checking if user is PIC of any branch')
              const { data: branchData } = await supabase
                .from('branches')
                .select('nama_branch')
                .eq('pic_id', user.id_user)
                .eq('is_active', true)
                .single()
              
              if (branchData?.nama_branch) {
                userAllowedBranches = [branchData.nama_branch]
                console.log('Found branch from PIC relationship:', branchData.nama_branch)
              } else {
                // Fallback 2: check cabang field in users table
                console.log('Not found as PIC, checking cabang field in users table')
                const { data: userProfile } = await supabase
                  .from('users')
                  .select('cabang')
                  .eq('id_user', user.id_user)
                  .single()
                
                if (userProfile?.cabang) {
                  userAllowedBranches = [userProfile.cabang]
                  console.log('Found branch from users table:', userProfile.cabang)
                } else {
                  console.warn('⚠️ User not assigned to any branch')
                  userAllowedBranches = [] // Show all branches with warning
                }
              }
            }
          }
        }
        
        console.log('Final allowed branches for user:', userAllowedBranches)
        console.log('User role:', user.role)
        setAllowedBranches(userAllowedBranches)
        setUserBranch(userAllowedBranches.length > 0 ? userAllowedBranches[0] : '')
        setIsUserDataLoaded(true)
      } catch (error) {
        console.error('Error parsing user data:', error)
        setIsUserDataLoaded(true)
      }
    } else {
      setIsUserDataLoaded(true)
    }
  }

  const handleStockAlertPrefill = async (alertData: any) => {
    // Set branch
    setFormData(prev => ({
      ...prev,
      cabang_id: alertData.branch_id.toString(),
      priority: alertData.alert_level === 'CRITICAL' ? 'tinggi' : 'sedang',
      keterangan: `${alertData.reason} - Current Stock: ${alertData.current_stock}, Safety Stock: ${alertData.safety_stock}`
    }))

    // Find product and add to PO
    const product = allProducts.find(p => p.id_product === alertData.product_id)
    if (product) {
      // Find suppliers for this product
      const matchingSuppliers = suppliers.filter(supplier => 
        supplier.nama_barang && 
        supplier.nama_barang.toLowerCase().includes(product.product_name.toLowerCase())
      )
      
      if (matchingSuppliers.length > 0) {
        const supplier = matchingSuppliers[0] // Use first available supplier
        const newItem: POItem = {
          product_id: product.id_product,
          product_name: product.product_name,
          qty: alertData.suggested_qty,
          unit: product.unit_kecil,
          unit_besar: product.unit_besar,
          satuan_besar: product.satuan_besar,
          keterangan: `Stock Alert - ${alertData.alert_level}`,
          supplier_name: supplier.nama_supplier,
          merk: product.merk || ''
        }
        setPOItems([newItem])
      }
    }

    // Show success message
    setTimeout(() => {
      alert(`✅ PO form pre-filled from stock alert!\n\nProduct: ${alertData.product_name}\nBranch: ${alertData.branch_name}\nSuggested Qty: ${alertData.suggested_qty}\nReason: ${alertData.reason}`)
    }, 1000)
  }

  const fetchBranches = async () => {
    try {
      console.log('Fetching branches with allowedBranches:', allowedBranches)
      
      let query = supabase
        .from('branches')
        .select('*')
        .order('nama_branch')
      
      // Jika user bukan admin, filter berdasarkan branch yang diizinkan
      if (allowedBranches.length > 0) {
        console.log('Filtering branches by:', allowedBranches)
        query = query.in('nama_branch', allowedBranches)
      } else {
        console.log('No branch filter applied (admin/super admin)')
      }
      
      const { data: branchesData, error } = await query
      
      if (error) throw error
      
      console.log('Fetched branches count:', branchesData?.length)
      console.log('Fetched branches:', branchesData)
      console.log('Current user role:', userRole)
      console.log('Current allowedBranches:', allowedBranches)
      setBranches(branchesData || [])
      
      // Auto-select branch jika hanya ada satu pilihan
      if (branchesData && branchesData.length === 1) {
        setFormData(prev => ({ 
          ...prev, 
          cabang_id: branchesData[0].id_branch.toString() 
        }))
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier, nomor_rekening, bank_penerima, nama_penerima, termin_tempo, estimasi_pengiriman, divisi, nama_barang, merk')
        .order('nama_supplier')

      const allSuppliers = suppliersData || []
      const uniqueSuppliers = allSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      )

      setSuppliers(allSuppliers)
      setUniqueSuppliers(uniqueSuppliers)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllProducts = async () => {
    try {
      const { data: products } = await supabase
        .from('nama_product')
        .select('*')
        .order('product_name')
      
      setAllProducts(products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const searchProductsWithSuppliers = () => {
    const filteredProducts = allProducts.filter(product =>
      product.product_name.toLowerCase().includes(searchProduct.toLowerCase())
    )

    const productsWithSuppliers = filteredProducts.map(product => {
      // Find suppliers that have this product in their nama_barang
      const matchingSuppliers = suppliers.filter(supplier => 
        supplier.nama_barang && 
        supplier.nama_barang.toLowerCase().includes(product.product_name.toLowerCase())
      )
      
      // Get unique suppliers
      const uniqueSuppliers = matchingSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      )

      return {
        product,
        suppliers: uniqueSuppliers
      }
    }).filter(item => item.suppliers.length > 0)

    setProductSuppliers(productsWithSuppliers)
  }

  const addProductToPO = (product: Product, supplier: Supplier) => {
    const existingItem = poItems.find(item => 
      item.product_id === product.id_product && 
      item.supplier_name === supplier.nama_supplier
    )
    
    if (existingItem) {
      setPOItems(poItems.map(item => 
        item.product_id === product.id_product && item.supplier_name === supplier.nama_supplier
          ? { 
              ...item, 
              qty: item.qty + 1
            }
          : item
      ))
    } else {
      const newItem: POItem = {
        product_id: product.id_product,
        product_name: product.product_name,
        qty: 1,
        unit: product.unit_kecil,
        unit_besar: product.unit_besar,
        satuan_besar: product.satuan_besar,
        keterangan: '',
        supplier_name: supplier.nama_supplier,
        merk: product.merk || ''
      }
      setPOItems([...poItems, newItem])
    }
    
    // Clear search and selection
    setSearchProduct('')
    setProductSuppliers([])
    setSelectedProductSupplier(null)
  }

  const updatePOItem = (productId: number, supplierName: string, field: string, value: number | string) => {
    setPOItems(poItems.map(item => {
      if (item.product_id === productId && item.supplier_name === supplierName) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const removePOItem = (productId: number, supplierName: string) => {
    setPOItems(poItems.filter(item => !(item.product_id === productId && item.supplier_name === supplierName)))
  }

  const groupedItems = poItems.reduce((groups, item) => {
    const supplier = item.supplier_name
    if (!groups[supplier]) {
      groups[supplier] = []
    }
    groups[supplier].push(item)
    return groups
  }, {} as Record<string, POItem[]>)

  const handleSavePO = async () => {
    try {
      // Validation
      if (!formData.cabang_id) {
        alert('Pilih cabang terlebih dahulu')
        return
      }
      
      if (poItems.length === 0) {
        alert('Tambahkan minimal satu item')
        return
      }
      
      console.log('Starting PO save...')
      
      // Generate PO number
      const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      
      // Group items by supplier to create separate POs
      const itemsBySupplier = poItems.reduce((groups, item) => {
        if (!groups[item.supplier_name]) {
          groups[item.supplier_name] = []
        }
        groups[item.supplier_name].push(item)
        return groups
      }, {} as Record<string, POItem[]>)

      // Create PO for each supplier
      for (const [supplierName, items] of Object.entries(itemsBySupplier)) {
        const supplier = suppliers.find(s => s.nama_supplier === supplierName)
        if (!supplier) continue
        
        const poInsertData = {
          po_number: `${poNumber}-${supplier.id_supplier}`,
          po_date: formData.po_date,
          cabang_id: parseInt(formData.cabang_id),
          supplier_id: supplier.id_supplier,
          status: 'Pending',
          priority: formData.priority,
          termin_days: supplier.termin_tempo || 30
        }

        console.log('Inserting PO data:', poInsertData)
        
        const { data: poData, error: poError } = await supabase.from('purchase_orders', poInsertData)
          .select()
          .single()

        if (poError) {
          console.error('PO insert error details:', JSON.stringify(poError, null, 2))
          console.error('Error keys:', Object.keys(poError))
          console.error('Error message:', poError.message)
          console.error('Error code:', poError.code)
          console.error('Error details:', poError.details)
          console.error('Error hint:', poError.hint)
          throw new Error(`Failed to insert PO: ${poError.message || poError.details || JSON.stringify(poError) || 'Unknown database error'}`)
        }
        
        console.log('PO created:', poData)

        // Save items for this PO
        const poItemsData = items.map(item => ({
          po_id: poData.id,
          product_id: item.product_id,
          qty: item.qty,
          keterangan: item.keterangan
        }))

        const { error: itemsError } = await supabase.from('po_items', poItemsData)

        if (itemsError) {
          console.error('Items insert error:', JSON.stringify(itemsError, null, 2))
          console.error('Items data:', poItemsData)
          throw new Error(`Failed to insert PO items: ${itemsError.message || itemsError.details || 'Unknown error'}`)
        }
      }

      alert('PO berhasil dibuat!')
      window.location.href = '/purchaseorder'
    } catch (error: any) {
      console.error('Error saving PO:', error)
      alert(`Gagal menyimpan PO: ${error.message}`)
    }
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/purchaseorder" className="text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} />
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="text-blue-600" size={22} />
            Buat PO Baru
            {formData.priority === 'tinggi' && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                🚨 URGENT
              </span>
            )}
          </h1>
          <p className="text-gray-600 text-sm">
            {formData.keterangan.includes('Stock Alert') 
              ? '⚡ Auto-filled from Stock Alert - Review and submit'
              : 'Buat pesanan pembelian ke supplier'
            }
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* PO Info */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-md font-semibold mb-3">Informasi PO</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal PO *</label>
              <input
                type="date"
                value={formData.po_date}
                onChange={(e) => setFormData({...formData, po_date: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cabang *</label>
              {userRole !== 'super admin' && userRole !== 'admin' && !userBranch && (
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                  ⚠️ Data cabang Anda belum diset. Silakan hubungi admin untuk mengupdate data user.
                </div>
              )}
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({...formData, cabang_id: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
                disabled={branches.length === 1}
              >
                <option value="">Pilih Cabang</option>
                {branches.map(branch => (
                  <option key={branch.id_branch} value={branch.id_branch}>
                    {branch.nama_branch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${
                  formData.priority === 'tinggi' ? 'bg-red-50 border-red-300' : ''
                }`}
              >
                <option value="biasa">Biasa</option>
                <option value="sedang">Sedang</option>
                <option value="tinggi">Tinggi (Urgent)</option>
              </select>
              {formData.priority === 'tinggi' && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ High priority PO - will be processed immediately
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cari Produk</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  className="w-full pl-8 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Cari nama produk..."
                />
              </div>
              
              {productSuppliers.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md text-sm">
                  {productSuppliers.map((item, index) => (
                    <div key={index} className="p-2 border-b border-gray-100 last:border-b-0">
                      <div className="font-medium text-gray-900 mb-1">
                        {item.product.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {item.product.merk || 'No Brand'}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        Tersedia di {item.suppliers.length} supplier
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.suppliers.map((supplier) => (
                          <button
                            key={supplier.id_supplier}
                            onClick={() => addProductToPO(item.product, supplier)}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs hover:bg-blue-200"
                          >
                            {supplier.nama_supplier}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${
                  formData.keterangan.includes('Stock Alert') ? 'bg-yellow-50 border-yellow-300' : ''
                }`}
                rows={3}
                placeholder="Keterangan tambahan..."
              />
              {formData.keterangan.includes('Stock Alert') && (
                <p className="text-xs text-yellow-700 mt-1">
                  📋 This PO was created from a stock alert. Review the details above.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items PO */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-md font-semibold mb-3">Items PO</h3>
          {poItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Package size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Belum ada item yang dipilih</p>
              <p className="text-xs">Pilih supplier dan tambahkan produk</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([supplierName, items]) => {
                const supplier = suppliers.find(s => s.nama_supplier === supplierName)
                return (
                <div key={supplierName} className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-3 py-2 border-b">
                    <div className="flex flex-col">
                      <h4 className="font-semibold text-blue-800 text-sm">Supplier: {supplierName}</h4>
                      <span className="text-xs text-blue-600">
                        Tempo: {supplier?.termin_tempo} hari
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.product_id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.merk || 'No Brand'}</div>
                          </div>
                          <button
                            onClick={() => removePOItem(item.product_id, item.supplier_name)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            <Minus size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <label className="text-xs text-gray-500">Qty</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.qty}
                              onChange={(e) => updatePOItem(item.product_id, item.supplier_name, 'qty', parseFloat(e.target.value) || 0)}
                              className="w-full border rounded px-2 py-1 text-sm"
                              min="0.01"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Unit</label>
                            <div className="border rounded px-2 py-1 bg-gray-50 text-sm">
                              {item.unit_besar}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <label className="text-xs text-gray-500">Keterangan</label>
                          <input
                            type="text"
                            value={item.keterangan}
                            onChange={(e) => updatePOItem(item.product_id, item.supplier_name, 'keterangan', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm"
                            placeholder="Keterangan..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 sticky bottom-0 bg-gray-50 p-2 border-t">
          <a href="/purchaseorder" className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Batal
          </a>
          <button 
            onClick={handleSavePO}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
            disabled={poItems.length === 0 || !formData.cabang_id}
          >
            <Save size={14} />
            Simpan PO
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreatePurchaseOrderPage() {
  return (
    <Layout>
      <PageAccessControl pageName="purchaseorder">
        <CreatePurchaseOrder />
      </PageAccessControl>
    </Layout>
  )
}
