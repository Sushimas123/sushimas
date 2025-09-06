"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../components/Layout'

export default function PermissionsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to new database-based permissions page
    router.replace('/permissions-db')
  }, [])

  return (
    <Layout>
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-gray-800">Redirecting...</h1>
        <p className="text-gray-600">Redirecting to new permissions system...</p>
      </div>
    </Layout>
  )
}