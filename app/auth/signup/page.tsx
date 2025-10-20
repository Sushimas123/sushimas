"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nama_lengkap: '',
    no_telp: '',
    cabang: '',
    selectedBranches: [] as string[]
  })
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, kode_branch, nama_branch')
        .eq('is_active', true)
        .order('nama_branch')

      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const handleBranchToggle = (branchCode: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBranches: prev.selectedBranches.includes(branchCode)
        ? prev.selectedBranches.filter(b => b !== branchCode)
        : [...prev.selectedBranches, branchCode]
    }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setMessage('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      // Test connection first
      console.log('Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (testError) {
        console.error('Connection test failed:', testError)
      }

      // Try signup with email confirmation
      console.log('Attempting signup for:', formData.email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            nama_lengkap: formData.nama_lengkap,
            no_telp: formData.no_telp,
            cabang: formData.cabang
          }
        }
      })

      console.log('Signup response:', { authData, authError })

      if (authError) {
        console.error('Auth error:', authError)
        if (authError.message.includes('User already registered')) {
          setMessage('Email already exists. Try logging in instead.')
          setTimeout(() => router.push('/auth/login'), 2000)
          return
        }
        throw authError
      }

      if (authData.user) {
        console.log('Auth user created:', authData.user.id)
        
        // Check if email confirmation is required
        if (!authData.user.email_confirmed_at) {
          setMessage('Account created! Please check your email and click the confirmation link to activate your account.')
          // Don't redirect, let user confirm email first
          return
        }
        
        setMessage('Account created! Redirecting to login...')
        
        // Try to create profile (optional)
        try {
          const insertData = {
            email: formData.email,
            nama_lengkap: formData.nama_lengkap,
            no_telp: formData.no_telp || null,
            cabang: formData.selectedBranches[0] || null,
            role: 'staff',
            is_active: true,
            auth_id: authData.user.id
          }
          
          const { data: userData, error: profileError } = await supabase
            .from('users')
            .insert(insertData)
            .select('id_user')
            .single()

          if (profileError) {
            console.error('Profile creation failed:', profileError)
          } else {
            console.log('Profile created successfully')
            
            // Insert user branches
            if (formData.selectedBranches.length > 0 && userData?.id_user) {
              const userBranches = formData.selectedBranches.map(branch => ({
                id_user: userData.id_user,
                kode_branch: branch
              }))
              
              const { error: branchError } = await supabase
                .from('user_branches')
                .insert(userBranches)
                
              if (branchError) {
                console.error('Branch insert error:', branchError)
              }
            }
          }
        } catch (dbError) {
          console.error('Database operation failed:', dbError)
        }

        // Redirect to login
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    } catch (error: any) {
      console.error('Signup failed:', error)
      
      // Fallback: Create user directly in custom table if Auth fails
      if (error.message.includes('Database error saving new user')) {
        try {
          console.log('Attempting manual user creation...')
          const { data: manualUser, error: manualError } = await supabase
            .from('users')
            .insert({
              email: formData.email,
              nama_lengkap: formData.nama_lengkap,
              no_telp: formData.no_telp || null,
              cabang: formData.selectedBranches[0] || null,
              role: 'staff',
              is_active: true,
              auth_id: null // Will be linked later
            })
            .select('id_user')
            .single()

          if (manualError) {
            console.error('Manual creation failed:', manualError)
            setMessage('Signup failed. Please contact administrator.')
          } else {
            console.log('Manual user created:', manualUser)
            
            // Insert user branches for manual creation
            if (formData.selectedBranches.length > 0 && manualUser?.id_user) {
              const userBranches = formData.selectedBranches.map(branch => ({
                id_user: manualUser.id_user,
                kode_branch: branch
              }))
              
              await supabase
                .from('user_branches')
                .insert(userBranches)
            }
            
            setMessage('Account created successfully! You can now login.')
            setTimeout(() => router.push('/auth/login'), 2000)
          }
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError)
          setMessage('Signup failed. Please try again or contact support.')
        }
      } else {
        setMessage(error.message || 'Signup failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-gray-600">Sign up for a new account</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="nama_lengkap"
                value={formData.nama_lengkap}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                name="no_telp"
                value={formData.no_telp}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Branches *
            </label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto">
              {branches.length === 0 ? (
                <p className="text-gray-500 text-sm">Loading branches...</p>
              ) : (
                branches.map(branch => (
                  <label key={branch.id_branch} className="flex items-center gap-2 text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={formData.selectedBranches.includes(branch.kode_branch)}
                      onChange={() => handleBranchToggle(branch.kode_branch)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>{branch.kode_branch} - {branch.nama_branch}</span>
                  </label>
                ))
              )}
            </div>
            {formData.selectedBranches.length === 0 && (
              <p className="text-red-500 text-xs mt-1">Please select at least one branch</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('created') || message.includes('verify')
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || formData.selectedBranches.length === 0}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-blue-600 hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}