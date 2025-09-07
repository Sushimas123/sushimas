const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qwydcxjhlvqvyjdoxxlq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3eWRjeGpobHZxdnlqZG94eGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1ODg1NDEsImV4cCI6MjA3MTE2NDU0MX0.ilpj0CNy-5emIHiywcvPSwRIzFDP1ufd9KqlipBX3-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function recreateCrudPermissions() {
  try {
    console.log('🗑️ Clearing existing data...');
    
    // Clear existing data
    const { error: deleteError } = await supabase
      .from('crud_permissions')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error deleting:', deleteError);
      return;
    }

    console.log('✅ Cleared existing data');

    // Insert all permissions one by one to avoid conflict issues
    const permissions = [
      // Super Admin permissions (full access)
      { role: 'super admin', page: 'ready', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'gudang', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'produksi', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'produksi_detail', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'analysis', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'esb', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'product_name', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'categories', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'recipes', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'supplier', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'branches', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'users', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'stock_opname', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'product_settings', can_create: true, can_edit: true, can_delete: true },
      { role: 'super admin', page: 'permissions-db', can_create: true, can_edit: true, can_delete: true },

      // Admin permissions (full access)
      { role: 'admin', page: 'ready', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'gudang', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'produksi', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'produksi_detail', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'analysis', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'esb', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'product_name', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'categories', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'recipes', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'supplier', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'branches', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'users', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'stock_opname', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'product_settings', can_create: true, can_edit: true, can_delete: true },
      { role: 'admin', page: 'permissions-db', can_create: true, can_edit: true, can_delete: true },

      // Finance permissions (read-only)
      { role: 'finance', page: 'ready', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'gudang', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'produksi', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'produksi_detail', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'analysis', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'esb', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'product_name', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'categories', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'recipes', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'supplier', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'branches', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'users', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'stock_opname', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'product_settings', can_create: false, can_edit: false, can_delete: false },
      { role: 'finance', page: 'permissions-db', can_create: false, can_edit: false, can_delete: false },

      // PIC_Branch permissions (create + edit, no delete for operational pages)
      { role: 'pic_branch', page: 'ready', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic_branch', page: 'gudang', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic_branch', page: 'produksi', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic_branch', page: 'produksi_detail', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic_branch', page: 'analysis', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'esb', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'product_name', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'categories', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'recipes', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'supplier', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'branches', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'users', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'stock_opname', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic_branch', page: 'product_settings', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic_branch', page: 'permissions-db', can_create: false, can_edit: false, can_delete: false },

      // Staff permissions (create only for basic operations)
      { role: 'staff', page: 'ready', can_create: true, can_edit: false, can_delete: false },
      { role: 'staff', page: 'gudang', can_create: true, can_edit: false, can_delete: false },
      { role: 'staff', page: 'produksi', can_create: true, can_edit: false, can_delete: false },
      { role: 'staff', page: 'produksi_detail', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'analysis', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'esb', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'product_name', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'categories', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'recipes', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'supplier', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'branches', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'users', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'stock_opname', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'product_settings', can_create: false, can_edit: false, can_delete: false },
      { role: 'staff', page: 'permissions-db', can_create: false, can_edit: false, can_delete: false }
    ];

    console.log('📝 Inserting permissions...');
    
    // Insert all permissions
    const { error: insertError } = await supabase
      .from('crud_permissions')
      .insert(permissions);

    if (insertError) {
      console.error('❌ Error inserting permissions:', insertError);
    } else {
      console.log('✅ Successfully inserted all CRUD permissions');
      console.log(`📊 Total permissions inserted: ${permissions.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

recreateCrudPermissions();