'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageAccessControl from '@/components/PageAccessControl';
import { supabase } from '@/src/lib/supabaseClient';

interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
  kota: string;
  is_active: boolean;
}

interface Category {
  id_category: number;
  category_name: string;
  description: string;
  is_active: boolean;
}

interface FormData {
  branch_code: string;
  amount: string;
  purpose: string;
  category: string;
  notes: string;
  attachment: File | null;
}

function CreatePettyCashRequestContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [formData, setFormData] = useState<FormData>({
    branch_code: '',
    amount: '',
    purpose: '',
    category: '',
    notes: '',
    attachment: null
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const selectedBranch = branches.find(b => b.kode_branch === formData.branch_code);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setDataLoading(true);
      
      // Get current user
      const user = localStorage.getItem('user');
      let userData = null;
      if (user) {
        userData = JSON.parse(user);
        setCurrentUser(userData);
      }

      // Fetch user's assigned branches from user_branches
      if (userData?.id_user) {
        const { data: userBranchData, error: userBranchError } = await supabase
          .from('user_branches')
          .select(`
            kode_branch,
            branches (
              id_branch,
              kode_branch,
              nama_branch,
              kota,
              is_active
            )
          `)
          .eq('id_user', userData.id_user)
          .eq('is_active', true);

        if (userBranchError) throw userBranchError;
        
        // Extract branch data from the join
        const branchData: Branch[] = [];
        if (userBranchData) {
          for (const ub of userBranchData) {
            const branch = ub.branches as any;
            if (branch && branch.is_active) {
              branchData.push(branch as Branch);
            }
          }
        }
        branchData.sort((a, b) => a.nama_branch.localeCompare(b.nama_branch));
        
        setBranches(branchData);
      } else {
        setBranches([]);
      }

      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id_category, category_name, description, is_active')
        .eq('is_active', true)
        .order('category_name');

      if (categoryError) throw categoryError;
      setCategories(categoryData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Gagal memuat data. Silakan refresh halaman.');
    } finally {
      setDataLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.branch_code) {
      newErrors.branch_code = 'Pilih cabang terlebih dahulu';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Masukkan jumlah yang valid';
    }

    if (formData.purpose.trim() && formData.purpose.trim().length < 10) {
      newErrors.purpose = 'Tujuan penggunaan minimal 10 karakter';
    }

    if (!formData.category) {
      newErrors.category = 'Pilih kategori pengeluaran';
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
      // Generate request number
      const requestNumber = `PC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      let attachmentUrl = null;
      
      console.log('FormData attachment:', formData.attachment);
      
      // Upload file to Supabase Storage if attachment exists
      if (formData.attachment) {
        console.log('Uploading file:', formData.attachment.name);
        const fileExt = formData.attachment.name.split('.').pop();
        const fileName = `${requestNumber}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('petty-cash-attachments')
          .upload(fileName, formData.attachment);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Gagal upload file: ${uploadError.message}`);
        }
        
        console.log('Upload success:', uploadData);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('petty-cash-attachments')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl;
        console.log('Attachment URL:', attachmentUrl);
      }
      
      // Insert into petty_cash_requests table
      console.log('Inserting with attachment URL:', attachmentUrl);
      const { data, error } = await supabase
        .from('petty_cash_requests')
        .insert({
          request_number: requestNumber,
          branch_code: formData.branch_code,
          requested_by: currentUser?.id_user,
          amount: parseFloat(formData.amount),
          purpose: formData.purpose || '',
          notes: formData.notes || '',
          attachment: attachmentUrl,
          status: 'pending'
        })
        .select();
      
      console.log('Insert result:', { data, error });

      if (error) throw error;
      
      alert(`Request berhasil dibuat!\nRequest Number: ${requestNumber}\nJumlah: ${formatCurrency(parseFloat(formData.amount))}`);
      
      router.push('/pettycash/request');
    } catch (error) {
      console.error('Error creating request:', error);
      alert(`Terjadi kesalahan saat membuat request: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Ukuran file maksimal 5MB');
      return;
    }
    handleInputChange('attachment', file);
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
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Buat Request Petty Cash</h1>
          <p className="text-sm text-gray-600">Isi form untuk membuat permintaan petty cash baru</p>
        </div>
        <a 
          href="/pettycash/request"
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
                    Cabang <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.branch_code}
                    onChange={(e) => handleInputChange('branch_code', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.branch_code ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  >
                    <option value="">Pilih Cabang</option>
                    {branches.map(branch => (
                      <option key={branch.id_branch} value={branch.kode_branch}>
                        {branch.nama_branch} ({branch.kode_branch})
                      </option>
                    ))}
                  </select>
                  {errors.branch_code && <p className="text-red-500 text-xs mt-1">{errors.branch_code}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="0"
                    min="1"
                    required
                  />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
                  {formData.amount && !errors.amount && (
                    <p className="text-green-600 text-xs mt-1">
                      💰 {formatCurrency(parseFloat(formData.amount) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map(category => (
                      <option key={category.id_category} value={category.category_name}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Pengaju</label>
                  <input
                    type="text"
                    value={currentUser?.nama_lengkap || currentUser?.email || 'Loading...'}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300 bg-gray-100"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Role: {currentUser?.role || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Purpose & Details */}
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Detail Penggunaan</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Tujuan Penggunaan
                  </label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) => handleInputChange('purpose', e.target.value)}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${errors.purpose ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Jelaskan untuk apa dana ini akan digunakan..."
                    rows={3}
                  />
                  {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>}
                  <p className="text-gray-500 text-xs mt-1">
                    {formData.purpose.length}/500 karakter (opsional, min 10 jika diisi)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Catatan Tambahan</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
                    placeholder="Informasi tambahan..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Attachment */}
            <div className="bg-white p-4 rounded-lg border">
              <h2 className="text-sm font-semibold mb-3">Lampiran (Opsional)</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  id="attachment"
                />
                <label htmlFor="attachment" className="cursor-pointer">
                  <div className="text-2xl mb-1">📎</div>
                  <p className="text-xs text-gray-600 mb-1">
                    Upload dokumen pendukung
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, JPG, PNG, DOC (Max 5MB)
                  </p>
                </label>
                
                {formData.attachment && (
                  <div className="mt-3 p-2 bg-blue-50 rounded border">
                    <p className="text-xs font-medium">📄 {formData.attachment.name}</p>
                    <p className="text-xs text-gray-500">
                      {(formData.attachment.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    
                    {/* Image Preview */}
                    {formData.attachment.type.startsWith('image/') && (
                      <div className="mt-2">
                        <img 
                          src={URL.createObjectURL(formData.attachment)} 
                          alt="Preview" 
                          className="max-w-full h-32 object-cover rounded border"
                        />
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => handleInputChange('attachment', null)}
                      className="text-red-600 text-xs mt-1 hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Branch Info */}
            {selectedBranch && (
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-sm font-semibold mb-3">Info Cabang</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-600">Nama Cabang</div>
                    <div className="text-sm font-medium">{selectedBranch.nama_branch}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Kode</div>
                    <div className="text-sm font-medium">{selectedBranch.kode_branch}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Kota</div>
                    <div className="text-sm font-medium">{selectedBranch.kota}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-sm font-semibold mb-3">Ringkasan</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-600">Jumlah:</span>
                  <span className="text-sm font-semibold">
                    {formData.amount ? formatCurrency(parseFloat(formData.amount)) : 'Rp 0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-600">Kategori:</span>
                  <span className="text-sm font-medium">{formData.category || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-600">Pengaju:</span>
                  <span className="text-sm font-medium">
                    {currentUser?.nama_lengkap || 'Loading...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                    Memproses...
                  </>
                ) : (
                  <>
                    💾 Submit Request
                  </>
                )}
              </button>
              
              <a
                href="/pettycash/request"
                className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
              >
                ❌ Batal
              </a>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CreatePettyCashRequestPage() {
  return (
    <PageAccessControl pageName="pettycash">
      <Layout>
        <CreatePettyCashRequestContent />
      </Layout>
    </PageAccessControl>
  );
}