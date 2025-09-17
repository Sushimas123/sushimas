"use client"

import { useEffect, useState } from 'react'
import { useNavigationPermissions } from '@/hooks/useNavigationPermissions'

export default function DebugPermissions() {
  const [user, setUser] = useState<any>(null)
  const { userRole, permissions, loading } = useNavigationPermissions()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  if (loading) return <div>Loading permissions...</div>

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="font-bold mb-2">Debug Permissions</h3>
      <div className="text-sm space-y-1">
        <p><strong>User Role:</strong> {userRole}</p>
        <p><strong>User Data:</strong> {JSON.stringify(user, null, 2)}</p>
        <p><strong>Stock Alert Permission:</strong> {permissions['stock-alert'] ? 'YES' : 'NO'}</p>
        <p><strong>Purchase Order Permission:</strong> {permissions['purchaseorder'] ? 'YES' : 'NO'}</p>
        <p><strong>Pivot Permission:</strong> {permissions['pivot'] ? 'YES' : 'NO'}</p>
        <p><strong>All Permissions:</strong></p>
        <pre className="bg-white p-2 rounded text-xs overflow-auto">
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </div>
    </div>
  )
}