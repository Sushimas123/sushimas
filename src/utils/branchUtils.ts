import { supabase } from '@/src/lib/supabaseClient';

// Branch settings management
export const getBranchSetting = async (branchId: number, settingKey: string): Promise<any> => {
  const { data } = await supabase
    .from('branch_settings')
    .select('setting_value, data_type')
    .eq('branch_id', branchId)
    .eq('setting_key', settingKey)
    .single();

  if (!data) return null;

  // Convert based on data type
  switch (data.data_type) {
    case 'boolean':
      return data.setting_value === 'true';
    case 'number':
      return parseFloat(data.setting_value) || 0;
    case 'json':
      try {
        return JSON.parse(data.setting_value);
      } catch {
        return null;
      }
    default:
      return data.setting_value;
  }
};

export const setBranchSetting = async (branchId: number, settingKey: string, value: any, dataType: string = 'string') => {
  const settingValue = dataType === 'json' ? JSON.stringify(value) : String(value);
  
  const { error } = await supabase
    .from('branch_settings')
    .upsert({
      branch_id: branchId,
      setting_key: settingKey,
      setting_value: settingValue,
      data_type: dataType,
      updated_at: new Date().toISOString()
    });

  return { error };
};

// Branch performance metrics
export const getBranchPerformance = async (branchId: number, dateRange: { start: string; end: string }) => {
  // Sales performance
  const { data: salesData } = await supabase
    .from('esb_harian')
    .select('qty_total, sales_date')
    .eq('branch', branchId)
    .gte('sales_date', dateRange.start)
    .lte('sales_date', dateRange.end);

  // Stock levels
  const { data: stockData } = await supabase
    .from('ready')
    .select('ready, waste')
    .eq('id_branch', branchId)
    .gte('tanggal_input', dateRange.start)
    .lte('tanggal_input', dateRange.end);

  // Production efficiency
  const { data: productionData } = await supabase
    .from('produksi')
    .select('total_konversi, tanggal_input')
    .eq('id_branch', branchId)
    .gte('tanggal_input', dateRange.start)
    .lte('tanggal_input', dateRange.end);

  return {
    totalSales: salesData?.reduce((sum, item) => sum + (item.qty_total || 0), 0) || 0,
    totalStock: stockData?.reduce((sum, item) => sum + (item.ready || 0), 0) || 0,
    totalWaste: stockData?.reduce((sum, item) => sum + (item.waste || 0), 0) || 0,
    totalProduction: productionData?.reduce((sum, item) => sum + (item.total_konversi || 0), 0) || 0,
    salesCount: salesData?.length || 0,
    stockCount: stockData?.length || 0,
    productionCount: productionData?.length || 0
  };
};

// Branch notifications
export const createBranchNotification = async (
  branchId: number,
  type: string,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) => {
  const { error } = await supabase
    .from('branch_notifications')
    .insert({
      branch_id: branchId,
      notification_type: type,
      title,
      message,
      priority
    });

  return { error };
};

export const getBranchNotifications = async (branchId: number, unreadOnly: boolean = false) => {
  let query = supabase
    .from('branch_notifications')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  return { data, error };
};

export const markNotificationAsRead = async (notificationId: number, userId: number) => {
  const { error } = await supabase
    .from('branch_notifications')
    .update({
      is_read: true,
      read_by: userId,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  return { error };
};

// Branch transfers
export const createBranchTransfer = async (transferData: {
  fromBranchId: number;
  toBranchId: number;
  productId: number;
  quantity: number;
  unitPrice?: number;
  notes?: string;
  createdBy: number;
}) => {
  // Generate transfer number
  const transferNo = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  const { data, error } = await supabase
    .from('transfer_barang')
    .insert({
      transfer_no: transferNo,
      from_branch_id: transferData.fromBranchId,
      to_branch_id: transferData.toBranchId,
      product_id: transferData.productId,
      quantity: transferData.quantity,
      unit_price: transferData.unitPrice || 0,
      total_value: (transferData.quantity * (transferData.unitPrice || 0)),
      notes: transferData.notes,
      created_by: transferData.createdBy
    })
    .select()
    .single();

  return { data, error };
};

export const getBranchTransfers = async (branchId: number, direction: 'incoming' | 'outgoing' | 'all' = 'all') => {
  let query = supabase
    .from('transfer_barang')
    .select(`
      *,
      from_branch:branches!from_branch_id(nama_branch),
      to_branch:branches!to_branch_id(nama_branch),
      product:nama_product!product_id(product_name),
      creator:users!created_by(nama_lengkap)
    `)
    .order('created_at', { ascending: false });

  if (direction === 'incoming') {
    query = query.eq('to_branch_id', branchId);
  } else if (direction === 'outgoing') {
    query = query.eq('from_branch_id', branchId);
  } else {
    query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
  }

  const { data, error } = await query;
  return { data, error };
};

// Branch hierarchy
export const getBranchHierarchy = async (parentId?: number) => {
  let query = supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('branch_level')
    .order('nama_branch');

  if (parentId) {
    query = query.eq('parent_branch_id', parentId);
  } else {
    query = query.is('parent_branch_id', null);
  }

  const { data, error } = await query;
  return { data, error };
};

// Branch validation
export const validateBranchCode = async (kodeBranch: string, excludeId?: number): Promise<boolean> => {
  let query = supabase
    .from('branches')
    .select('id_branch')
    .eq('kode_branch', kodeBranch);

  if (excludeId) {
    query = query.neq('id_branch', excludeId);
  }

  const { data } = await query.single();
  return !data; // true if code is available
};

// Auto-generate branch code
export const generateBranchCode = async (cityName: string): Promise<string> => {
  const cityCode = cityName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'XXX';
  
  for (let i = 1; i <= 999; i++) {
    const code = `${cityCode}${i.toString().padStart(3, '0')}`;
    const isAvailable = await validateBranchCode(code);
    if (isAvailable) {
      return code;
    }
  }
  
  throw new Error('Unable to generate unique branch code');
};