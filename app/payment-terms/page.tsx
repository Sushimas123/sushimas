'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { Plus, Edit2, Trash2, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';
import { canPerformActionSync } from '@/src/utils/rolePermissions';

interface PaymentTerm {
  id_payment_term: number;
  term_name: string;
  days: number;
  calculation_type: string;
  payment_dates?: number[];
  payment_day_of_week?: number;
  early_payment_discount: number;
  early_payment_days: number;
  late_payment_penalty: number;
  grace_period_days: number;
  minimum_order_amount: number;
  maximum_order_amount?: number;
  requires_guarantee: boolean;
  guarantee_type?: string;
  description?: string;
  is_active: boolean;
}

export default function PaymentTermsPage() {
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [userRole, setUserRole] = useState<string>('guest');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    term_name: '',
    days: 0,
    calculation_type: 'from_invoice',
    payment_dates: '',
    payment_day_of_week: '',
    early_payment_discount: 0,
    early_payment_days: 0,
    late_payment_penalty: 0,
    grace_period_days: 0,
    minimum_order_amount: 0,
    maximum_order_amount: '',
    requires_guarantee: false,
    guarantee_type: '',
    description: ''
  });

  useEffect(() => {
    // Get user role
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'guest');
    }
    
    fetchPaymentTerms();
  }, []);

  const fetchPaymentTerms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .order('term_name');

      if (error) throw error;
      setPaymentTerms(data || []);
    } catch (error) {
      console.error('Error fetching payment terms:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userData = localStorage.getItem('user');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      // Process payment_dates - convert string to array or null
      let paymentDatesArray = null;
      if (formData.calculation_type === 'fixed_dates' && formData.payment_dates.trim()) {
        paymentDatesArray = formData.payment_dates.split(',').map(d => {
          const num = parseInt(d.trim());
          return isNaN(num) ? null : num;
        }).filter(d => d !== null);
      }
      
      // Process payment_day_of_week - convert string to number or null
      let paymentDayOfWeek = null;
      if (formData.calculation_type === 'weekly' && formData.payment_day_of_week.trim()) {
        paymentDayOfWeek = parseInt(formData.payment_day_of_week);
        if (isNaN(paymentDayOfWeek)) paymentDayOfWeek = null;
      }
      
      const submitData = {
        term_name: formData.term_name,
        days: formData.days,
        calculation_type: formData.calculation_type,
        payment_dates: paymentDatesArray,
        payment_day_of_week: paymentDayOfWeek,
        early_payment_discount: formData.early_payment_discount,
        early_payment_days: formData.early_payment_days,
        late_payment_penalty: formData.late_payment_penalty,
        grace_period_days: formData.grace_period_days,
        minimum_order_amount: formData.minimum_order_amount,
        maximum_order_amount: formData.maximum_order_amount ? parseFloat(formData.maximum_order_amount) : null,
        requires_guarantee: formData.requires_guarantee,
        guarantee_type: formData.guarantee_type || null,
        description: formData.description || null,
        is_active: true,
        created_by: currentUser?.id_user
      };

      if (editingId) {
        const { error } = await supabase
          .from('payment_terms')
          .update(submitData)
          .eq('id_payment_term', editingId);
        
        if (error) throw error;
        alert('Payment term berhasil diupdate!');
      } else {
        const { error } = await supabase
          .from('payment_terms')
          .insert([submitData]);
        
        if (error) throw error;
        alert('Payment term berhasil ditambahkan!');
      }

      resetForm();
      fetchPaymentTerms();
    } catch (error: any) {
      console.error('Error saving payment term:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      alert(`Gagal menyimpan payment term: ${error.message || 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      term_name: '',
      days: 0,
      calculation_type: 'from_invoice',
      payment_dates: '',
      payment_day_of_week: '',
      early_payment_discount: 0,
      early_payment_days: 0,
      late_payment_penalty: 0,
      grace_period_days: 0,
      minimum_order_amount: 0,
      maximum_order_amount: '',
      requires_guarantee: false,
      guarantee_type: '',
      description: ''
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (term: PaymentTerm) => {
    setFormData({
      term_name: term.term_name,
      days: term.days,
      calculation_type: term.calculation_type,
      payment_dates: term.payment_dates?.join(',') || '',
      payment_day_of_week: term.payment_day_of_week?.toString() || '',
      early_payment_discount: term.early_payment_discount,
      early_payment_days: term.early_payment_days,
      late_payment_penalty: term.late_payment_penalty,
      grace_period_days: term.grace_period_days,
      minimum_order_amount: term.minimum_order_amount,
      maximum_order_amount: term.maximum_order_amount?.toString() || '',
      requires_guarantee: term.requires_guarantee,
      guarantee_type: term.guarantee_type || '',
      description: term.description || ''
    });
    setEditingId(term.id_payment_term);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus payment term ini?')) return;

    try {
      const { error } = await supabase
        .from('payment_terms')
        .delete()
        .eq('id_payment_term', id);

      if (error) throw error;
      alert('Payment term berhasil dihapus!');
      fetchPaymentTerms();
    } catch (error) {
      console.error('Error deleting payment term:', error);
      alert('Gagal menghapus payment term');
    }
  };

  const filteredTerms = useMemo(() => {
    if (!searchTerm) return paymentTerms;
    const search = searchTerm.toLowerCase();
    return paymentTerms.filter(term =>
      term.term_name.toLowerCase().includes(search) ||
      term.description?.toLowerCase().includes(search)
    );
  }, [paymentTerms, searchTerm]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="payment-terms">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-lg font-bold text-gray-800">💳 Payment Terms</h1>
          </div>

          {showAddForm && (
            <div className="bg-white p-4 rounded shadow mb-4">
              <h3 className="font-medium mb-3 text-sm">
                {editingId ? 'Edit Payment Term' : 'Tambah Payment Term'}
              </h3>
              
              {/* Panduan */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-xs shadow-md">
                <h4 className="font-medium text-blue-800 mb-2">📋 Panduan Pengisian:</h4>
                <div className="space-y-1 text-blue-700">
                  <div><strong>From Invoice:</strong> NET 30 (30 hari dari tanggal invoice)</div>
                  <div><strong>From Delivery:</strong> 30 hari dari tanggal barang diterima</div>
                  <div><strong>Fixed Dates:</strong> 15,30 (tanggal 15 & 30) atau 999 (akhir bulan)</div>
                  <div><strong>Weekly:</strong> Pembayaran setiap hari tertentu dalam seminggu</div>
                  <div><strong>Early Discount:</strong> 2% diskon jika bayar dalam 10 hari</div>
                  <div><strong>Late Penalty:</strong> 1.5% denda per bulan jika terlambat</div>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nama Term *</label>
                    <input
                      type="text"
                      value={formData.term_name}
                      onChange={(e) => setFormData({...formData, term_name: e.target.value})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: NET 30, 2/10 NET 30"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Jenis Perhitungan *</label>
                    <select
                      value={formData.calculation_type}
                      onChange={(e) => setFormData({...formData, calculation_type: e.target.value})}
                      className="border px-2 py-1 rounded text-xs w-full"
                    >
                      <option value="from_invoice">📄 From Invoice</option>
                      <option value="from_delivery">📦 From Delivery</option>
                      <option value="fixed_dates">📅 Fixed Dates</option>
                      <option value="weekly">📆 Weekly</option>
                    </select>
                  </div>
                </div>

                {(formData.calculation_type === 'from_invoice' || formData.calculation_type === 'from_delivery') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Jumlah Hari *</label>
                    <input
                      type="number"
                      value={formData.days}
                      onChange={(e) => setFormData({...formData, days: parseInt(e.target.value) || 0})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 30 (untuk NET 30)"
                      required
                    />
                  </div>
                )}

                {formData.calculation_type === 'fixed_dates' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tanggal Pembayaran</label>
                    <input
                      type="text"
                      value={formData.payment_dates}
                      onChange={(e) => setFormData({...formData, payment_dates: e.target.value})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 15,30 atau 999 (akhir bulan)"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Tips: Gunakan 999 untuk akhir bulan
                    </div>
                  </div>
                )}

                {formData.calculation_type === 'weekly' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hari Pembayaran</label>
                    <select
                      value={formData.payment_day_of_week}
                      onChange={(e) => setFormData({...formData, payment_day_of_week: e.target.value})}
                      className="border px-2 py-1 rounded text-xs w-full"
                    >
                      <option value="">Pilih Hari</option>
                      <option value="0">🌅 Minggu</option>
                      <option value="1">📅 Senin</option>
                      <option value="2">📅 Selasa</option>
                      <option value="3">📅 Rabu</option>
                      <option value="4">📅 Kamis</option>
                      <option value="5">📅 Jumat</option>
                      <option value="6">📅 Sabtu</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">💰 Early Discount (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.early_payment_discount}
                      onChange={(e) => setFormData({...formData, early_payment_discount: parseFloat(e.target.value) || 0})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 2 (untuk 2%)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">⏰ Early Days</label>
                    <input
                      type="number"
                      value={formData.early_payment_days}
                      onChange={(e) => setFormData({...formData, early_payment_days: parseInt(e.target.value) || 0})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 10 (dalam 10 hari)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">⚠️ Late Penalty (% per bulan)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.late_payment_penalty}
                      onChange={(e) => setFormData({...formData, late_payment_penalty: parseFloat(e.target.value) || 0})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 1.5 (untuk 1.5% per bulan)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">💵 Min Order Amount</label>
                    <input
                      type="number"
                      value={formData.minimum_order_amount}
                      onChange={(e) => setFormData({...formData, minimum_order_amount: parseFloat(e.target.value) || 0})}
                      className="border px-2 py-1 rounded text-xs w-full"
                      placeholder="Contoh: 1000000 (1 juta)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">📝 Deskripsi</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full border px-2 py-1 rounded text-xs"
                    rows={2}
                    placeholder="Contoh: Pembayaran 30 hari setelah invoice dengan diskon 2% jika bayar dalam 10 hari"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    {editingId ? 'Update' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white p-3 rounded shadow mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border px-2 py-1 rounded text-xs"
              />
              {canPerformActionSync(userRole, 'payment-terms', 'create') && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
                >
                  <Plus size={12} />
                  Add
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTerms.map((term) => (
              <div key={term.id_payment_term} className="bg-white rounded shadow p-3">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-sm">{term.term_name}</h3>
                  <div className="flex gap-1">
                    {canPerformActionSync(userRole, 'payment-terms', 'edit') && (
                      <button
                        onClick={() => handleEdit(term)}
                        className="text-blue-600 p-1"
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {canPerformActionSync(userRole, 'payment-terms', 'delete') && (
                      <button
                        onClick={() => handleDelete(term.id_payment_term)}
                        className="text-red-600 p-1"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-500" />
                    {term.calculation_type === 'from_delivery' ? (
                      <span>{term.days} hari dari delivery</span>
                    ) : term.calculation_type === 'fixed_dates' ? (
                      <span>Tanggal {term.payment_dates?.join(', ')}</span>
                    ) : term.calculation_type === 'weekly' ? (
                      <span>Setiap {['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][term.payment_day_of_week || 0]}</span>
                    ) : (
                      <span>{term.days} hari</span>
                    )}
                  </div>

                  <div className="text-xs text-blue-600">
                    {term.calculation_type === 'from_delivery' ? '📦 Mulai saat barang datang' :
                     term.calculation_type === 'fixed_dates' ? '📅 Tanggal tetap' :
                     term.calculation_type === 'weekly' ? '📆 Mingguan' : '📄 Dari invoice'}
                  </div>

                  {term.early_payment_discount > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <DollarSign size={12} />
                      <span>{term.early_payment_discount}% diskon ({term.early_payment_days} hari)</span>
                    </div>
                  )}

                  {term.late_payment_penalty > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertTriangle size={12} />
                      <span>{term.late_payment_penalty}% denda</span>
                    </div>
                  )}

                  {term.minimum_order_amount > 0 && (
                    <div className="text-gray-600">
                      Min: {formatCurrency(term.minimum_order_amount)}
                    </div>
                  )}

                  {term.description && (
                    <div className="text-gray-600 text-xs mt-1 p-1 bg-gray-50 rounded">
                      {term.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredTerms.length === 0 && (
            <div className="bg-white p-6 rounded shadow text-center">
              <p className="text-gray-500 text-sm">
                {searchTerm ? 'No terms found' : 'No payment terms yet'}
              </p>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}