const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key needed

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@sushimas.com',
      password: 'admin123',
      email_confirm: true
    })

    if (authError) {
      console.error('Auth error:', authError)
      return
    }

    console.log('User created in Auth:', authData.user.email)

    // 2. Create user in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          email: 'admin@sushimas.com',
          password_hash: 'admin123',
          nama_lengkap: 'Administrator',
          role: 'admin',
          is_active: true
        }
      ])

    if (userError) {
      console.error('Users table error:', userError)
      return
    }

    console.log('Admin user created successfully!')
    console.log('Email: admin@sushimas.com')
    console.log('Password: admin123')

  } catch (error) {
    console.error('Error:', error)
  }
}

createAdmin()