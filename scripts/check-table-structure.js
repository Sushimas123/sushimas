const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qwydcxjhlvqvyjdoxxlq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3eWRjeGpobHZxdnlqZG94eGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1ODg1NDEsImV4cCI6MjA3MTE2NDU0MX0.ilpj0CNy-5emIHiywcvPSwRIzFDP1ufd9KqlipBX3-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  try {
    // Check existing data
    const { data, error } = await supabase
      .from('crud_permissions')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Current data:', data);
    }

    // Try to insert one record to see the exact error
    const { error: insertError } = await supabase
      .from('crud_permissions')
      .insert({ role: 'test', page: 'test', can_create: true, can_edit: true, can_delete: true });

    if (insertError) {
      console.log('Insert error:', insertError);
    } else {
      console.log('Insert successful');
      
      // Clean up test record
      await supabase
        .from('crud_permissions')
        .delete()
        .eq('role', 'test')
        .eq('page', 'test');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTable();