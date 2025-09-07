// Debug script untuk test audit trail
// Jalankan: node debug-audit.js

const { createClient } = require('@supabase/supabase-js');

// Ganti dengan credentials Anda
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuditTrail() {
  console.log('🔍 Testing audit trail...');
  
  // 1. Cek apakah tabel audit_log ada
  const { data: tables, error: tableError } = await supabase
    .from('audit_log')
    .select('*')
    .limit(1);
    
  if (tableError) {
    console.log('❌ Tabel audit_log tidak ada:', tableError.message);
    console.log('📝 Jalankan SQL script: /sql/add_audit_trail.sql');
    return;
  }
  
  console.log('✅ Tabel audit_log ada');
  
  // 2. Cek apakah ada data audit
  const { data: auditData, error: auditError } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', 'branches')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (auditError) {
    console.log('❌ Error mengambil audit data:', auditError.message);
    return;
  }
  
  console.log('📊 Audit data untuk branches:', auditData?.length || 0, 'records');
  if (auditData && auditData.length > 0) {
    console.log('🔍 Latest audit:', auditData[0]);
  }
  
  // 3. Test insert audit log manual
  const { error: insertError } = await supabase
    .from('audit_log')
    .insert({
      table_name: 'test',
      record_id: 999,
      action: 'TEST',
      user_name: 'Debug User',
      new_values: { test: 'data' }
    });
    
  if (insertError) {
    console.log('❌ Error insert audit log:', insertError.message);
  } else {
    console.log('✅ Manual audit log insert berhasil');
  }
}

testAuditTrail().catch(console.error);