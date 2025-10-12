const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function assignUserToBranch() {
  try {
    console.log('🔧 Assigning users to branches...\n')

    // Get all users and branches first
    const [usersResult, branchesResult] = await Promise.all([
      supabase.from('users').select('id_user, nama_lengkap, role').order('nama_lengkap'),
      supabase.from('branches').select('kode_branch, nama_branch, is_active').eq('is_active', true).order('nama_branch')
    ])

    if (usersResult.error) throw usersResult.error
    if (branchesResult.error) throw branchesResult.error

    const users = usersResult.data
    const branches = branchesResult.data

    console.log('👥 Available Users:')
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.nama_lengkap} (ID: ${user.id_user}, Role: ${user.role})`)
    })

    console.log('\n🏢 Available Branches:')
    branches.forEach((branch, index) => {
      console.log(`  ${index + 1}. ${branch.nama_branch} (${branch.kode_branch})`)
    })

    // Example assignments - modify as needed
    const assignments = [
      // Example: Assign user ID 2 to branch 'PUSAT'
      // { userId: 2, branchCode: 'PUSAT' },
      // { userId: 3, branchCode: 'CABANG1' },
    ]

    if (assignments.length === 0) {
      console.log('\n📝 No assignments configured. Edit the script to add assignments.')
      console.log('Example:')
      console.log('const assignments = [')
      console.log('  { userId: 2, branchCode: "PUSAT" },')
      console.log('  { userId: 3, branchCode: "CABANG1" },')
      console.log(']')
      return
    }

    console.log('\n🔗 Processing assignments...')
    
    for (const assignment of assignments) {
      const user = users.find(u => u.id_user === assignment.userId)
      const branch = branches.find(b => b.kode_branch === assignment.branchCode)
      
      if (!user) {
        console.log(`❌ User ID ${assignment.userId} not found`)
        continue
      }
      
      if (!branch) {
        console.log(`❌ Branch ${assignment.branchCode} not found`)
        continue
      }

      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('user_branches')
        .select('id_user_branch')
        .eq('id_user', assignment.userId)
        .eq('kode_branch', assignment.branchCode)
        .single()

      if (existing) {
        console.log(`⚠️  ${user.nama_lengkap} already assigned to ${branch.nama_branch}`)
        continue
      }

      // Create assignment
      const { error } = await supabase
        .from('user_branches')
        .insert({
          id_user: assignment.userId,
          kode_branch: assignment.branchCode,
          is_active: true
        })

      if (error) {
        console.log(`❌ Failed to assign ${user.nama_lengkap} to ${branch.nama_branch}: ${error.message}`)
      } else {
        console.log(`✅ Assigned ${user.nama_lengkap} to ${branch.nama_branch}`)
      }
    }

    console.log('\n✨ Assignment process completed!')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

assignUserToBranch()