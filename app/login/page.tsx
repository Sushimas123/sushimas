"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Try direct database login first (bypass auth for development)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id_user, email, nama_lengkap, role, cabang, password_hash')
        .eq('email', email.trim())
        .eq('is_active', true)
        .single()

      if (userData && userData.password_hash === password) {
        // Direct login success
        const userInfo = {
          id_user: userData.id_user,
          email: userData.email,
          nama_lengkap: userData.nama_lengkap,
          role: userData.role,
          cabang: userData.cabang
        }
        
        localStorage.setItem('user', JSON.stringify(userInfo))
        document.cookie = `user=${JSON.stringify(userInfo)}; path=/; max-age=86400`
        router.push('/dashboard')
        return
      }

      // Fallback to Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) {
        console.log('Supabase auth error:', error)
        throw new Error('Invalid email or password')
      }

      if (data.user) {
        const { data: authUserData, error: authUserError } = await supabase
          .from('users')
          .select('id_user, email, nama_lengkap, role, cabang')
          .eq('email', data.user.email)
          .eq('is_active', true)
          .single()

        if (authUserError || !authUserData) {
          throw new Error('User data not found')
        }

        const userInfo = {
          id_user: authUserData.id_user,
          email: authUserData.email,
          nama_lengkap: authUserData.nama_lengkap,
          role: authUserData.role,
          cabang: authUserData.cabang
        }
        
        localStorage.setItem('user', JSON.stringify(userInfo))
        document.cookie = `user=${JSON.stringify(userInfo)}; path=/; max-age=86400`
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            {/* Logo dari folder public */}
            <Image 
              src="/sushimas-logo.png" // File berada di public/sushimas-logo.png
              alt="Sushimas Logo"
              width={300}
              height={300}
              className="rounded-lg"
            />
          </div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900">
            - Sushimas -
          </h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          <div className="text-center">
            <Link href="/register" className="text-blue-600 hover:text-blue-800">
              Don't have account? Create one
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}