const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function updateFinanceView() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'app/finance/sql/create_view.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    console.log('Updating finance_dashboard_view...')
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('Error updating view:', error)
      return
    }
    
    console.log('Finance dashboard view updated successfully!')
    console.log('The view now uses received_qty and actual_price for accurate calculations.')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

updateFinanceView()