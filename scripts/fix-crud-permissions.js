const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qwydcxjhlvqvyjdoxxlq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3eWRjeGpobHZxdnlqZG94eGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1ODg1NDEsImV4cCI6MjA3MTE2NDU0MX0.ilpj0CNy-5emIHiywcvPSwRIzFDP1ufd9KqlipBX3-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCrudPermissions() {
  try {
    // Add unique constraint
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE crud_permissions ADD CONSTRAINT IF NOT EXISTS crud_permissions_role_page_unique UNIQUE (role, page);'
    });
    
    if (constraintError) {
      console.log('Constraint may already exist:', constraintError.message);
    } else {
      console.log('✅ Added unique constraint');
    }

    // Insert default permissions
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

      // PIC Branch permissions (create + edit, no delete for operational pages)
      { role: 'pic branch', page: 'ready', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic branch', page: 'gudang', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic branch', page: 'produksi', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic branch', page: 'produksi_detail', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic branch', page: 'analysis', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'esb', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'product_name', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'categories', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'recipes', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'supplier', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'branches', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'users', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'stock_opname', can_create: true, can_edit: true, can_delete: false },
      { role: 'pic branch', page: 'product_settings', can_create: false, can_edit: false, can_delete: false },
      { role: 'pic branch', page: 'permissions-db', can_create: false, can_edit: false, can_delete: false },

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

    const { error: insertError } = await supabase
      .from('crud_permissions')
      .upsert(permissions, { onConflict: 'role,page' });

    if (insertError) {
      console.error('❌ Error inserting permissions:', insertError);
    } else {
      console.log('✅ Successfully inserted/updated all CRUD permissions');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixCrudPermissions();