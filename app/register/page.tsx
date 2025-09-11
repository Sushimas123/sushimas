"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nama_lengkap: '',
    role: 'staff',
    cabang: ''
  })
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('nama_branch')
    setBranches(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
      })

      if (authError) throw authError

      // 2. Create user in users table
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          email: formData.email.trim(),
          password_hash: formData.password,
          nama_lengkap: formData.nama_lengkap,
          role: formData.role,
          cabang: formData.cabang,
          is_active: true
        }])

      if (userError) throw userError

      alert('User berhasil dibuat! Silakan login.')
      router.push('/login')

    } catch (err: any) {
      setError(err.message || 'Gagal membuat user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <Image 
              src="/sushimas-logo.png"
              alt="Sushimas Logo"
              width={200}
              height={200}
              className="rounded-lg"
            />
          </div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900">
            Sushimas
          </h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Create new account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Nama Lengkap"
              value={formData.nama_lengkap}
              onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})}
            />
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={formData.cabang}
              onChange={(e) => setFormData({...formData, cabang: e.target.value})}
            >
              <option value="">Pilih Cabang</option>
              {branches.map(branch => (
                <option key={branch.id_branch} value={branch.kode_branch}>
                  {branch.nama_branch}
                </option>
              ))}
            </select>
            
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <div className="text-center">
            <Link href="/login" className="text-blue-600 hover:text-blue-800">
              Already have account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}