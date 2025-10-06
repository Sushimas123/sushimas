import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { getUserData } from '@/utils/userStorage'

interface CRUDPermissions {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}

export function useCRUDPermissions(pageName: string) {
  const [permissions, setPermissions] = useState<CRUDPermissions>({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const userData = getUserData()
        if (!userData) {
          setLoading(false)
          return
        }

        const user = JSON.parse(userData)
        
        // Super admin and admin have all permissions
        if (user.role === 'super admin' || user.role === 'admin') {
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true
          })
          setLoading(false)
          return
        }

        // Fetch CRUD permissions for the role and page
        const { data, error } = await supabase
          .from('crud_permissions')
          .select('can_create, can_read, can_update, can_delete')
          .eq('role', user.role)
          .eq('page_name', pageName)
          .single()

        if (error || !data) {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false
          })
        } else {
          setPermissions({
            canCreate: data.can_create,
            canRead: data.can_read,
            canUpdate: data.can_update,
            canDelete: data.can_delete
          })
        }
      } catch (error) {
        console.error('Error fetching CRUD permissions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [pageName])

  return { permissions, loading }
}
