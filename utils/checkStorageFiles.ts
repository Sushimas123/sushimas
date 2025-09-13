import { supabase } from '@/src/lib/supabaseClient'

export const listStorageFiles = async () => {
  try {
    const { data, error } = await supabase.storage
      .from('po-bukti')
      .list()
    
    if (error) throw error
    
    console.log('Files in po-bukti bucket:', data)
    return data
  } catch (error) {
    console.error('Error listing files:', error)
    return []
  }
}

export const getFileUrl = (filename: string) => {
  const { data } = supabase.storage
    .from('po-bukti')
    .getPublicUrl(filename)
  
  return data.publicUrl
}