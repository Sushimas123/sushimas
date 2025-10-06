'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from "@/src/lib/supabaseClient";
import { ArrowLeft, Upload } from 'lucide-react';
import Layout from '../../../../components/Layout';
import PageAccessControl from '../../../../components/PageAccessControl';

export default function UploadPhotoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !params?.id) return;

    setUploading(true);
    try {
      // Get old photo URL
      const { data: asset } = await supabase
        .from('assets')
        .select('photo_url')
        .eq('asset_id', params!.id)
        .single();

      // Delete old photo from storage if exists
      if (asset?.photo_url && asset.photo_url.includes('asset-photos')) {
        const oldFileName = asset.photo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('asset-photos').remove([oldFileName]);
        }
      }

      const fileName = `${params!.id}-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('asset-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('asset-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('assets')
        .update({ photo_url: publicUrl })
        .eq('asset_id', params!.id);

      if (updateError) throw updateError;

      alert('Photo uploaded successfully!');
      router.push(`/assets/${params!.id}`);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <PageAccessControl pageName="assets">
        <div className="p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Upload Asset Photo</h1>
              <p className="text-gray-600">Asset ID: {params?.id}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Photo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {preview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="w-full max-w-md h-64 object-cover rounded-lg border"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!preview || uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}