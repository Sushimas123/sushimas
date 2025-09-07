import { supabase } from '@/src/lib/supabaseClient';

interface AuditLogEntry {
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id?: number;
  user_name?: string;
  old_values?: any;
  new_values?: any;
}

// Get current user info from localStorage
const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  
  const userData = localStorage.getItem('user');
  if (!userData) return null;
  
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
};

// Log audit trail
export const logAuditTrail = async (entry: AuditLogEntry) => {
  try {
    const currentUser = getCurrentUser();
    
    const auditEntry = {
      ...entry,
      user_id: currentUser?.id_user || null,
      user_name: currentUser?.nama_lengkap || 'Unknown User',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('audit_log')
      .insert([auditEntry]);

    if (error) {
      console.error('Failed to log audit trail:', error);
    }
  } catch (error) {
    console.error('Error logging audit trail:', error);
  }
};

// Enhanced insert with audit trail
export const insertWithAudit = async (
  tableName: string, 
  data: any, 
  options: { select?: string } = {}
) => {
  const currentUser = getCurrentUser();
  
  // Add audit fields to data
  const dataWithAudit = {
    ...data,
    created_by: currentUser?.id_user || null,
    updated_by: currentUser?.id_user || null
  };

  const query = supabase.from(tableName).insert([dataWithAudit]);
  
  if (options.select) {
    query.select(options.select);
  }

  const result = await query;

  // Log audit trail
  if (!result.error && result.data) {
    const record = Array.isArray(result.data) ? result.data[0] : result.data;
    const recordId = record?.id || record?.id_user || record?.id_branch || record?.id_product || record?.id_ready || record?.uniqueid_gudang || record?.ready_no;
    if (recordId) {
      await logAuditTrail({
        table_name: tableName,
        record_id: recordId,
        action: 'INSERT',
        new_values: dataWithAudit
      });
    }
  }

  return result;
};

// Enhanced update with audit trail
export const updateWithAudit = async (
  tableName: string,
  data: any,
  matchCondition: any,
  options: { select?: string } = {}
) => {
  const currentUser = getCurrentUser();
  
  // Get old values first
  const { data: oldData } = await supabase
    .from(tableName)
    .select('*')
    .match(matchCondition)
    .single();

  // Add audit fields to data
  const dataWithAudit = {
    ...data,
    updated_by: currentUser?.id_user || null,
    updated_at: new Date().toISOString()
  };

  const query = supabase
    .from(tableName)
    .update(dataWithAudit)
    .match(matchCondition);
    
  if (options.select) {
    query.select(options.select);
  }

  const result = await query;

  // Log audit trail
  if (!result.error && oldData) {
    const recordId = oldData.id || oldData.id_user || oldData.id_branch || oldData.id_product || oldData.id_ready || oldData.uniqueid_gudang || oldData.ready_no;
    if (recordId) {
      await logAuditTrail({
        table_name: tableName,
        record_id: recordId,
        action: 'UPDATE',
        old_values: oldData,
        new_values: { ...oldData, ...dataWithAudit }
      });
    }
  }

  return result;
};

// Enhanced delete with audit trail (soft delete)
export const deleteWithAudit = async (
  tableName: string,
  matchCondition: any
) => {
  const currentUser = getCurrentUser();
  
  // Get old values first
  const { data: oldData } = await supabase
    .from(tableName)
    .select('*')
    .match(matchCondition)
    .single();

  // Soft delete by setting is_active = false
  const result = await supabase
    .from(tableName)
    .update({ 
      is_active: false,
      updated_by: currentUser?.id_user || null,
      updated_at: new Date().toISOString()
    })
    .match(matchCondition);

  // Log audit trail
  if (!result.error && oldData) {
    const recordId = oldData.id || oldData.id_user || oldData.id_branch || oldData.id_product || oldData.id_ready || oldData.uniqueid_gudang || oldData.ready_no;
    if (recordId) {
      await logAuditTrail({
        table_name: tableName,
        record_id: recordId,
        action: 'DELETE',
        old_values: oldData
      });
    }
  }

  return result;
};

// Get audit history for a record
export const getAuditHistory = async (tableName: string, recordId: number) => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  return { data, error };
};