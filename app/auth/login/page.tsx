"use client"

import { useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        // Skip email confirmation error and try to find user by email
        if (authError.message.includes('Email not confirmed')) {
          console.log('Email not confirmed, trying to find user by email...')
          
          // Try to find user in custom table by email
          const { data: userByEmail, error: emailError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('is_active', true)
            .single()

          if (emailError || !userByEmail) {
            throw new Error('User not found or inactive')
          }

          // Store user data and redirect
          localStorage.setItem('user', JSON.stringify(userByEmail))
          window.location.replace('/dashboard')
          return
        } else {
          throw authError
        }
      }

      // Check if user exists
      if (!authData.user) {
        throw new Error('Authentication failed - no user data')
      }

      // Get user data from custom users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .eq('is_active', true)
        .single()

      if (userError || !userData) {
        // Try to find by email if auth_id lookup fails
        const { data: userByEmail, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('is_active', true)
          .single()

        if (emailError || !userByEmail) {
          // User exists in auth but not in custom table - create profile
          console.log('Creating missing user profile for:', authData.user.email)
          
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              email: authData.user.email,
              password_hash: 'supabase_managed',
              nama_lengkap: authData.user.user_metadata?.nama_lengkap || authData.user.email?.split('@')[0] || 'User',
              no_telp: authData.user.user_metadata?.no_telp || null,
              cabang: authData.user.user_metadata?.cabang || null,
              role: 'staff',
              is_active: true,
              auth_id: authData.user.id
            })
            .select()
            .single()

          if (createError) {
            console.error('Failed to create user profile:', createError)
            throw new Error('Failed to create user profile')
          }

          localStorage.setItem('user', JSON.stringify(newProfile))
        } else {
          // Update auth_id if found by email
          await supabase
            .from('users')
            .update({ auth_id: authData.user.id })
            .eq('id_user', userByEmail.id_user)

          // Store user data
          localStorage.setItem('user', JSON.stringify({
            ...userByEmail,
            auth_id: authData.user.id
          }))
        }
      } else {
        // Store user data
        localStorage.setItem('user', JSON.stringify(userData))
      }

      console.log('Login successful, user data stored:', JSON.parse(localStorage.getItem('user') || '{}'))
      console.log('Current URL:', window.location.href)
      
      // Force immediate redirect
      window.location.replace('/dashboard')
      
    } catch (error: any) {
      console.error('Login error:', error)
      setMessage(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setMessage('Please enter your email first')
      return
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) throw error
      setMessage('Verification email sent! Check your inbox.')
    } catch (error: any) {
      setMessage(error.message || 'Failed to send verification email')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
          <p className="mt-2 text-gray-600">Access your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('verify') || message.includes('sent') 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
              {message.includes('verify') && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="ml-2 underline hover:no-underline"
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/signup')}
                className="text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}