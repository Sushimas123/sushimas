"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const [message, setMessage] = useState('Verifying your email...')
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback from email link
        const { data, error } = await supabase.auth.getUser()
        
        console.log('Callback - User data:', data)
        console.log('Callback - Error:', error)
        
        if (error) {
          console.error('Auth callback error:', error)
          setMessage('Email verification failed. Please try again.')
          return
        }

        if (data.user) {
          console.log('User found:', data.user.id)
          console.log('Email confirmed at:', data.user.email_confirmed_at)
          
          if (!data.user.email_confirmed_at) {
            setMessage('Email not yet confirmed. Please check your email.')
            return
          }
          
          // Create profile after email confirmation
          try {
            const { error: profileError } = await supabase
              .from('users')
              .upsert({
                email: data.user.email,
                auth_id: data.user.id,
                role: 'staff',
                is_active: true
              })

            if (profileError) {
              console.error('Profile creation failed:', profileError)
            }
          } catch (dbError) {
            console.error('Database operation failed:', dbError)
          }

          setMessage('Email verified successfully! Redirecting to login...')
          setTimeout(() => {
            router.push('/auth/login')
          }, 2000)
        } else {
          setMessage('No session found. Please try signing up again.')
        }
      } catch (error) {
        console.error('Callback handling failed:', error)
        setMessage('Verification failed. Please try again.')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Email Verification</h2>
          <p className="mt-4 text-gray-600">{message}</p>
        </div>
        
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  )
}