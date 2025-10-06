'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { ArrowLeft, Save, Camera, X } from 'lucide-react';
import Layout from '../../../components/Layout';
import PageAccessControl from '../../../components/PageAccessControl';
import { AssetCategory } from '@/src/types/assets';

export default function CreateAssetPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    asset_id: '',
    asset_name: '',
    category_id: '',
    id_branch: '',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_price: '',
    current_value: '',
    supplier: '',
    location: 'DAPUR',
    status: 'ACTIVE',
    condition: 'GOOD',
    warranty_expiry: '',
    notes: '',
    quantity: '1'
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchBranches();
    generateAssetId();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('asset_categories')
      .select('*')
      .order('category_name');
    if (data) setCategories(data);
  };

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id_branch, nama_branch, kode_branch')
      .eq('is_active', true)
      .order('nama_branch');
    if (data) setBranches(data);
  };

  const generateAssetId = async () => {
    const { data } = await supabase
      .from('assets')
      .select('asset_id')
      .order('asset_id', { ascending: false })
      .limit(1);
    
    const lastId = data?.[0]?.asset_id || 'AST-000';
    const num = parseInt(lastId.split('-')[1]) + 1;
    setFormData(prev => ({ ...prev, asset_id: `AST-${num.toString().padStart(3, '0')}` }));
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Regenerate asset_id to avoid duplicate
      const { data: lastAsset } = await supabase
        .from('assets')
        .select('asset_id')
        .order('asset_id', { ascending: false })
        .limit(1);
      
      const lastId = lastAsset?.[0]?.asset_id || 'AST-000';
      const num = parseInt(lastId.split('-')[1]) + 1;
      const newAssetId = `AST-${num.toString().padStart(3, '0')}`;

      let photoUrl = null;
      
      // Upload photo to storage if selected
      if (photoFile) {
        const fileName = `${newAssetId}-${Date.now()}.${photoFile.name.split('.').pop()}`;
        
        const { error: uploadError } = await supabase.storage
          .from('asset-photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('asset-photos')
          .getPublicUrl(fileName);
        
        photoUrl = publicUrl;
      }
      
      const { error } = await supabase
        .from('assets')
        .insert([{
          asset_id: newAssetId,
          asset_name: formData.asset_name,
          brand: formData.brand || null,
          model: formData.model || null,
          serial_number: formData.serial_number || null,
          supplier: formData.supplier || null,
          location: formData.location,
          status: formData.status,
          condition: formData.condition,
          notes: formData.notes || null,
          category_id: parseInt(formData.category_id),
          id_branch: parseInt(formData.id_branch) || null,
          purchase_price: parseFloat(formData.purchase_price) || null,
          current_value: parseFloat(formData.current_value) || null,
          purchase_date: formData.purchase_date || null,
          warranty_expiry: formData.warranty_expiry || null,
          photo_url: photoUrl,
          quantity: parseInt(formData.quantity) || 1
        }]);

      if (error) throw error;
      
      alert('Asset created successfully!');
      router.push('/assets');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageAccessControl pageName="assets">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Add New Asset</h1>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset ID</label>
                <input
                  type="text"
                  value={formData.asset_id}
                  onChange={(e) => setFormData({...formData, asset_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset Name *</label>
                <input
                  type="text"
                  value={formData.asset_name}
                  onChange={(e) => setFormData({...formData, asset_name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={formData.id_branch}
                  onChange={(e) => setFormData({...formData, id_branch: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Price</label>
                <input
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value, current_value: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Value</label>
                <input
                  type="number"
                  value={formData.current_value}
                  onChange={(e) => setFormData({...formData, current_value: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="DAPUR">Dapur</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="GUDANG">Gudang</option>
                  <option value="KASIR">Kasir</option>
                  <option value="OFFICE">Office</option>
                  <option value="LOBBY">Lobby</option>
                  <option value="TOILET">Toilet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="BROKEN">Broken</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Expiry</label>
                <input
                  type="date"
                  value={formData.warranty_expiry}
                  onChange={(e) => setFormData({...formData, warranty_expiry: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Asset Photo</label>
              {!photoPreview ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="text-sm text-gray-600 mb-2">Upload asset photo</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Choose File
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full max-w-xs h-48 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? 'Saving...' : 'Save Asset'}
              </button>
            </div>
          </form>
        </div>
      </PageAccessControl>
    </Layout>
  );
}