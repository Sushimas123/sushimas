"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { User, Camera, Save, Eye, EyeOff } from 'lucide-react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

interface UserProfile {
  id_user: number
  username: string
  nama_lengkap: string
  email: string
  no_telp: string
  alamat: string
  foto_profile: string
  role: string
  created_at: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    email: '',
    no_hp: '',
    alamat: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user.id_user) {
        alert('User tidak ditemukan')
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id_user', user.id_user)
        .single()

      if (error) throw error

      setProfile(data)
      setFormData({
        nama_lengkap: data.nama_lengkap || '',
        email: data.email || '',
        no_hp: data.no_telp || '',
        alamat: data.alamat || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      alert('Gagal memuat profil')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB')
      return
    }

    try {
      setUploading(true)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id_user}_${Date.now()}.${fileExt}`
      
      // Try to upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        // If bucket doesn't exist, show helpful message
        if (uploadError.message.includes('Bucket not found')) {
          alert('Storage bucket belum dibuat. Silakan hubungi admin untuk setup storage.')
          return
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('users')
        .update({ foto_profile: publicUrl })
        .eq('id_user', profile?.id_user)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, foto_profile: publicUrl } : null)
      
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      user.foto_profile = publicUrl
      localStorage.setItem('user', JSON.stringify(user))

      alert('Foto profil berhasil diupdate')
    } catch (error) {
      console.error('Upload error details:', {
        error,
        type: typeof error,
        message: error instanceof Error ? error.message : 'No message',
        stack: error instanceof Error ? error.stack : 'No stack',
        keys: error && typeof error === 'object' ? Object.keys(error) : 'Not object'
      })
      
      let errorMessage = 'Unknown error'
      if (error && typeof error === 'object') {
        if ('message' in error && error.message) {
          errorMessage = String(error.message)
        } else if ('error' in error && error.error) {
          errorMessage = String(error.error)
        } else {
          errorMessage = JSON.stringify(error)
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      alert('Gagal mengupload foto: ' + errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!profile) return

    if (!formData.nama_lengkap.trim()) {
      alert('Nama lengkap harus diisi')
      return
    }

    if (!formData.email.trim()) {
      alert('Email harus diisi')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('Format email tidak valid')
      return
    }

    if (formData.no_hp && !/^[0-9+\-\s()]+$/.test(formData.no_hp)) {
      alert('Format nomor HP tidak valid')
      return
    }

    if (formData.new_password) {
      if (!formData.current_password) {
        alert('Password lama harus diisi')
        return
      }
      if (formData.new_password !== formData.confirm_password) {
        alert('Konfirmasi password tidak cocok')
        return
      }
      if (formData.new_password.length < 6) {
        alert('Password baru minimal 6 karakter')
        return
      }
    }

    try {
      setSaving(true)

      const updateData: any = {
        nama_lengkap: formData.nama_lengkap.trim(),
        email: formData.email.trim(),
        no_telp: formData.no_hp.trim(),
        alamat: formData.alamat.trim()
      }

      if (formData.new_password) {
        updateData.password = formData.new_password
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id_user', profile.id_user)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, ...updateData } : null)
      
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      Object.assign(user, updateData)
      localStorage.setItem('user', JSON.stringify(user))

      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }))

      alert('Profil berhasil diupdate')
      
      // Navigate back to dashboard after successful save
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1000)
    } catch (error) {
      console.error('Save profile error details:', {
        error,
        type: typeof error,
        message: error instanceof Error ? error.message : 'No message',
        stack: error instanceof Error ? error.stack : 'No stack',
        keys: error && typeof error === 'object' ? Object.keys(error) : 'Not object'
      })
      
      let errorMessage = 'Unknown error'
      if (error && typeof error === 'object') {
        if ('message' in error && error.message) {
          errorMessage = String(error.message)
        } else if ('error' in error && error.error) {
          errorMessage = String(error.error)
        } else {
          errorMessage = JSON.stringify(error)
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      alert('Gagal menyimpan profil: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="profile">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <User className="text-blue-600" size={28} />
                <div>
                  <h1 className="text-xl font-bold text-gray-800">Profil Saya</h1>
                  <p className="text-gray-600 text-sm">Kelola informasi profil dan keamanan akun</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                    {profile?.foto_profile ? (
                      <img 
                        src={profile.foto_profile} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={32} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="font-medium text-gray-800">{profile?.nama_lengkap}</h3>
                  <p className="text-sm text-gray-600">{profile?.role}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploading ? 'Mengupload...' : 'Klik kamera untuk ganti foto'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    name="nama_lengkap"
                    value={formData.nama_lengkap}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Masukkan email"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email akan digunakan untuk verifikasi</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor HP
                  </label>
                  <input
                    type="tel"
                    name="no_hp"
                    value={formData.no_hp}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Masukkan nomor HP"
                  />
                  <p className="text-xs text-gray-500 mt-1">Nomor HP akan digunakan untuk verifikasi</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat
                  </label>
                  <textarea
                    name="alamat"
                    value={formData.alamat}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Masukkan alamat lengkap"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-800 mb-3">Ubah Password</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password Lama
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="current_password"
                          value={formData.current_password}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Masukkan password lama"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password Baru
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="new_password"
                        value={formData.new_password}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Masukkan password baru"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Konfirmasi Password Baru
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirm_password"
                        value={formData.confirm_password}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Konfirmasi password baru"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  )
}