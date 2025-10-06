import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePhotos() {
  console.log('Starting photo migration...');

  // Get all assets with base64 photos
  const { data: assets, error } = await supabase
    .from('assets')
    .select('asset_id, photo_url')
    .not('photo_url', 'is', null)
    .like('photo_url', 'data:image%');

  if (error) {
    console.error('Error fetching assets:', error);
    return;
  }

  console.log(`Found ${assets?.length || 0} assets with base64 photos`);

  for (const asset of assets || []) {
    try {
      console.log(`Migrating ${asset.asset_id}...`);

      // Convert base64 to blob
      const base64Data = asset.photo_url.split(',')[1];
      const mimeType = asset.photo_url.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
      const extension = mimeType.split('/')[1];
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // Upload to storage
      const fileName = `${asset.asset_id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('asset-photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('asset-photos')
        .getPublicUrl(fileName);

      // Update database
      const { error: updateError } = await supabase
        .from('assets')
        .update({ photo_url: publicUrl })
        .eq('asset_id', asset.asset_id);

      if (updateError) throw updateError;

      console.log(`✅ Migrated ${asset.asset_id}`);
    } catch (err) {
      console.error(`❌ Failed to migrate ${asset.asset_id}:`, err);
    }
  }

  console.log('Migration completed!');
}

migratePhotos();
