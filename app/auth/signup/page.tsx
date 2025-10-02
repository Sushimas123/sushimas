"use client"

import { useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nama_lengkap: '',
    no_telp: '',
    cabang: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            cabang: formData.cabang || null,
            role: 'staff',
            is_active: true,
            auth_id: authData.user.id
          }
          
          const { error: profileError } = await supabase
            .from('users')
            .insert(insertData)

          if (profileError) {
            console.error('Profile creation failed:', profileError)
          } else {
            console.log('Profile created successfully')
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
              cabang: formData.cabang || null,
              role: 'staff',
              is_active: true,
              auth_id: null // Will be linked later
            })
            .select()
            .single()

          if (manualError) {
            console.error('Manual creation failed:', manualError)
            setMessage('Signup failed. Please contact administrator.')
          } else {
            console.log('Manual user created:', manualUser)
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
              Branch
            </label>
            <div className="relative">
              <select
                name="cabang"
                value={formData.cabang}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select your branch</option>
                <option value="JAK729">JAK729 - Sushimas Condet</option>
                <option value="BEK516">BEK516 - Sushimas Grand Galaxy</option>
                <option value="DEP464">DEP464 - Sushimas Depok</option>
                <option value="TAN624">TAN624 - Sushimas Serpong</option>
                <option value="BOG853">BOG853 - Sushimas Cibinong</option>
                <option value="BEK068">BEK068 - Sushimas Grand Wisata</option>
                <option value="BEK458">BEK458 - Sushimas Harapan Indah</option>
                <option value="JAK672">JAK672 - Central Condet</option>
                <option value="BEK261">BEK261 - Central Grandwis</option>
              </select>
            </div>
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
            disabled={loading}
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