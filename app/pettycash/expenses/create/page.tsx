'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface FormData {
  request_id: string;
  category_id: string;
  expense_date: string;
  description: string;
  amount: string;
  qty: string;
  harga: string;
  receipt_number: string;
  vendor_name: string;
  notes: string;
  receipt_image: File | null;
  product_id: string;
}

interface Request {
  id: number;
  request_number: string;
  amount: number; // This will now represent total available (amount + carried_balance)
  status: string;
  branch_code: string;
  parent_request_id?: number;
  carried_balance?: number;
  branches?: {
    nama_branch: string;
  }[];
}

interface Category {
  id_category: number;
  category_name: string;
}

interface Product {
  id_product: number;
  product_name: string;
  category: string;
  merk?: string;
  supplier_id?: number;
}

interface Supplier {
  id_supplier: number;
  nama_supplier: string;
  nama_barang?: string;
}

function CreateExpenseContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [productSuppliers, setProductSuppliers] = useState<{product: Product, suppliers: Supplier[]}[]>([]);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const [formData, setFormData] = useState<FormData>({
    request_id: '',
    category_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    qty: '1',
    harga: '',
    receipt_number: '',
    vendor_name: '',
    notes: '',
    receipt_image: null,
    product_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchProduct.length >= 2) {
      searchProductsWithSuppliers();
    } else {
      setProductSuppliers([]);
    }
  }, [searchProduct, products, suppliers]);

  const fetchData = async () => {
    try {
      setDataLoading(true);

      // Get user data and check role
      const userData = localStorage.getItem('user');
      let userRole = '';
      let allowedBranchCodes: string[] = [];
      
      if (userData) {
        const user = JSON.parse(userData);
        userRole = user.role;
        
        // For non-admin users, get their allowed branches
        if (userRole !== 'super admin' && userRole !== 'admin' && user.id_user) {
          const { data: userBranches } = await supabase
            .from('user_branches')
            .select('kode_branch')
            .eq('id_user', user.id_user)
            .eq('is_active', true);
          
          allowedBranchCodes = userBranches?.map(ub => ub.kode_branch) || [];
        }
      }

      // Fetch disbursed requests with branch filtering
      let requestQuery = supabase
        .from('petty_cash_requests')
        .select(`
          id, request_number, amount, status, branch_code, parent_request_id, carried_balance
        `)
        .eq('status', 'disbursed')
        .order('created_at', { ascending: false });
      
      // Apply branch filter for non-admin users
      if (userRole !== 'super admin' && userRole !== 'admin' && allowedBranchCodes.length > 0) {
        requestQuery = requestQuery.in('branch_code', allowedBranchCodes);
      }
      
      const { data: requestData, error: requestError } = await requestQuery;

      if (requestError) throw requestError;
      
      // Get branch names separately
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('kode_branch, nama_branch');
        
      if (branchError) throw branchError;

      console.log('Raw request data:', requestData);

      // Filter out requests that already have settlements
      const availableRequests = [];
      for (const request of requestData || []) {
        const { data: existingSettlement } = await supabase
          .from('petty_cash_settlements')
          .select('id')
          .eq('request_id', request.id)
          .single();

        if (!existingSettlement) {
          availableRequests.push(request);
        }
      }
      
      console.log('Available requests after filtering:', availableRequests);
      // Transform the data to match our interface with total available amount
      const transformedRequests = availableRequests.map(request => {
        const totalAvailable = request.amount + (request.carried_balance || 0);
        const branch = branchData?.find(b => b.kode_branch === request.branch_code);
        return {
          ...request,
          amount: totalAvailable, // Show total available instead of just amount
          branches: branch ? [{ nama_branch: branch.nama_branch }] : undefined
        };
      });
      
      setRequests(transformedRequests);

      // Categories and products fetching remains the same

      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id_category, category_name')
        .eq('is_active', true)
        .order('category_name');

      if (categoryError) throw categoryError;
      setCategories(categoryData || []);

      // Fetch products
      const { data: productData, error: productError } = await supabase
        .from('nama_product')
        .select('*')
        .eq('is_active', true)
        .order('product_name');

      if (productError) throw productError;
      setProducts(productData || []);

      // Fetch suppliers
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('id_supplier, nama_supplier, nama_barang')
        .order('nama_supplier');

      if (supplierError) throw supplierError;
      setSuppliers(supplierData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Gagal memuat data. Silakan refresh halaman.');
    } finally {
      setDataLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.request_id) {
      newErrors.request_id = 'Pilih request terlebih dahulu';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Pilih kategori terlebih dahulu';
    }

    if (!formData.expense_date) {
      newErrors.expense_date = 'Tanggal expense harus diisi';
    }



    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Masukkan jumlah yang valid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const user = localStorage.getItem('user');
      const currentUser = user ? JSON.parse(user) : null;
      
      if (!currentUser?.id_user) {
        throw new Error('User tidak ditemukan');
      }

      let receiptImageUrl = null;

      // Upload image if provided
      if (formData.receipt_image) {
        const fileExt = formData.receipt_image.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('petty-cash-attachments')
          .upload(fileName, formData.receipt_image);

        if (uploadError) throw uploadError;
        
        receiptImageUrl = uploadData.path;
      }

      const { data, error } = await supabase
        .from('petty_cash_expenses')
        .insert({
          request_id: parseInt(formData.request_id),
          category_id: parseInt(formData.category_id),
          expense_date: formData.expense_date,
          description: formData.description.trim() || '',
          amount: parseFloat(formData.amount),
          qty: parseFloat(formData.qty),
          harga: parseFloat(formData.harga),
          receipt_number: formData.receipt_number.trim() || null,
          vendor_name: formData.vendor_name.trim() || null,
          notes: formData.notes.trim() || null,
          receipt_image_url: receiptImageUrl,
          created_by: currentUser.id_user,
          product_id: formData.product_id ? parseInt(formData.product_id) : null
        })
        .select();

      if (error) throw error;
      
      alert('Expense berhasil dibuat!');
      router.push('/pettycash/expenses');
    } catch (error) {
      console.error('Error creating expense:', error);
      alert(`Terjadi kesalahan: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getLatestPrice = async (productId: number): Promise<number> => {
    try {
      // 1. Try to get latest actual price from po_price_history (most accurate)
      const { data: priceHistory } = await supabase
        .from('po_price_history')
        .select('actual_price')
        .eq('product_id', productId)
        .not('actual_price', 'is', null)
        .order('received_date', { ascending: false })
        .limit(1)
        .single();
      
      if (priceHistory?.actual_price) {
        return priceHistory.actual_price;
      }
      
      // 2. Fallback to latest price from po_items (actual_price or harga)
      const { data: latestPrice } = await supabase
        .from('po_items')
        .select('actual_price, harga')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestPrice?.actual_price) {
        return latestPrice.actual_price;
      }
      
      if (latestPrice?.harga) {
        return latestPrice.harga;
      }
      
      // 3. Final fallback to master price from nama_product
      const { data: product } = await supabase
        .from('nama_product')
        .select('harga')
        .eq('id_product', productId)
        .single();
      
      return product?.harga || 0;
    } catch (error) {
      console.error('Error getting price:', error);
      return 0;
    }
  };

  const searchProductsWithSuppliers = () => {
    const filteredProducts = products.filter(product =>
      product.product_name.toLowerCase().includes(searchProduct.toLowerCase())
    );

    const productsWithSuppliers = filteredProducts.map(product => {
      // Method 1: Find suppliers that have this product in their nama_barang
      let matchingSuppliers = suppliers.filter(supplier => 
        supplier.nama_barang && 
        supplier.nama_barang.toLowerCase().includes(product.product_name.toLowerCase())
      );
      
      // Method 2: If no suppliers found, use supplier_id from product
      if (matchingSuppliers.length === 0 && product.supplier_id) {
        const directSupplier = suppliers.find(supplier => 
          supplier.id_supplier === product.supplier_id
        );
        if (directSupplier) {
          matchingSuppliers = [directSupplier];
        }
      }
      
      // Method 3: If still no suppliers, show first 3 suppliers as fallback
      if (matchingSuppliers.length === 0) {
        matchingSuppliers = suppliers.slice(0, 3);
      }
      
      // Get unique suppliers
      const filteredUniqueSuppliers = matchingSuppliers.filter((supplier, index, self) => 
        index === self.findIndex(s => s.nama_supplier.toLowerCase() === supplier.nama_supplier.toLowerCase())
      );

      return {
        product,
        suppliers: filteredUniqueSuppliers
      };
    });

    setProductSuppliers(productsWithSuppliers);
  };

  const addProductToExpense = async (product: Product, supplier: Supplier) => {
    // Find matching category by name
    const matchingCategory = categories.find(c => 
      c.category_name.toLowerCase() === product.category.toLowerCase()
    );
    
    // Get latest price
    const latestPrice = await getLatestPrice(product.id_product);
    
    setFormData(prev => ({ 
      ...prev, 
      vendor_name: `${product.product_name} - ${supplier.nama_supplier}`,
      category_id: matchingCategory?.id_category.toString() || '',
      harga: latestPrice.toString(),
      amount: (parseFloat(prev.qty) * latestPrice).toString(),
      product_id: product.id_product.toString()
    }));
    
    // Clear search
    setSearchProduct('');
    setProductSuppliers([]);
    
    if (errors.vendor_name) {
      setErrors(prev => ({ ...prev, vendor_name: '' }));
    }
  };

  const handleQtyChange = (qty: string) => {
    const qtyNum = parseFloat(qty) || 0;
    const hargaNum = parseFloat(formData.harga) || 0;
    setFormData(prev => ({ 
      ...prev, 
      qty,
      amount: (qtyNum * hargaNum).toString()
    }));
  };

  const handleHargaChange = (harga: string) => {
    const qtyNum = parseFloat(formData.qty) || 0;
    const hargaNum = parseFloat(harga) || 0;
    setFormData(prev => ({ 
      ...prev, 
      harga,
      amount: (qtyNum * hargaNum).toString()
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange('receipt_image', file);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tambah Expense</h1>
          <p className="text-sm text-gray-600">Isi form untuk menambah pengeluaran petty cash</p>
        </div>
        <a 
          href="/pettycash/expenses"
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          ← Kembali
        </a>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Main Form */}
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Informasi Dasar</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Request <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.request_id}
                    onChange={(e) => handleInputChange('request_id', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.request_id ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  >
                    <option value="">Pilih Request</option>
                    {requests.map(request => (
                      <option key={request.id} value={request.id}>
                        {request.request_number} - {formatCurrency(request.amount)}
                      </option>
                    ))}
                  </select>
                  {errors.request_id && <p className="text-red-500 text-xs mt-1">{errors.request_id}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => handleInputChange('expense_date', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.expense_date ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  {errors.expense_date && <p className="text-red-500 text-xs mt-1">{errors.expense_date}</p>}
                </div>

              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Nama Barang
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                    placeholder="Cari nama produk..."
                  />
                  
                  {productSuppliers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded bg-white shadow-lg">
                      {productSuppliers.map((item, index) => (
                        <div key={index} className="p-2 border-b border-gray-100 last:border-b-0">
                          <div className="font-medium text-gray-900 mb-0.5 text-xs">
                            {item.product.product_name}
                          </div>
                          <div className="text-xs text-gray-500 mb-0.5">
                            {item.product.merk || 'No Brand'}
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            {item.suppliers.length} supplier
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.suppliers.map((supplier) => (
                              <button
                                key={supplier.id_supplier}
                                type="button"
                                onClick={() => addProductToExpense(item.product, supplier)}
                                className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200"
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
                
                {formData.vendor_name && (
                  <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <span className="text-green-800">✓ Dipilih: {formData.vendor_name}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">

              <div>
                  <label className="block text-xs font-medium mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.category_id ? categories.find(c => c.id_category.toString() === formData.category_id)?.category_name || '' : ''}
                    className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100 border-gray-300"
                    placeholder="Otomatis terisi dari vendor"
                    readOnly
                  />
                  <input
                    type="hidden"
                    value={formData.category_id}
                  />
                  {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.qty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                    placeholder="1"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Harga Satuan (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.harga}
                    onChange={(e) => handleHargaChange(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Total (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100 border-gray-300"
                    placeholder="0"
                    readOnly
                  />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
                  {formData.amount && !errors.amount && (
                    <p className="text-green-600 text-xs mt-1">
                      💰 {formatCurrency(parseFloat(formData.amount) || 0)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Detail Expense</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                    rows={3}
                    placeholder="Jelaskan detail pengeluaran..."
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      No. Receipt
                    </label>
                    <input
                      type="text"
                      value={formData.receipt_number}
                      onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                      placeholder="Nomor struk/receipt"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Catatan
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                    rows={2}
                    placeholder="Catatan tambahan (opsional)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Upload Foto Receipt
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                  />
                  {formData.receipt_image && (
                    <p className="text-green-600 text-xs mt-1">
                      📷 {formData.receipt_image.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Ringkasan</h2>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Request:</span>
                  <span className="font-medium">
                    {formData.request_id ? 
                      requests.find(r => r.id.toString() === formData.request_id)?.request_number || 'Unknown'
                      : '-'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Cabang:</span>
                  <span className="font-medium text-blue-600">
                    {formData.request_id ? 
                      requests.find(r => r.id.toString() === formData.request_id)?.branches?.[0]?.nama_branch || '-'
                      : '-'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Kategori:</span>
                  <span className="font-medium">
                    {formData.category_id ? 
                      categories.find(c => c.id_category.toString() === formData.category_id)?.category_name || 'Unknown'
                      : '-'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-medium">
                    {formData.expense_date ? 
                      new Date(formData.expense_date).toLocaleDateString('id-ID')
                      : '-'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold text-green-600">
                    {formData.amount ? formatCurrency(parseFloat(formData.amount)) : 'Rp 0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4">
          <a
            href="/pettycash/expenses"
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Batal
          </a>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateExpensePage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <CreateExpenseContent />
      </Layout>
    </PageAccessControl>
  );
}