import { useState, useEffect } from 'react'
import { canViewColumn } from '@/src/utils/dbPermissions'

export const useColumnPermissions = (userRole: string, tableName: string, data: any[]) => {
  const [permittedColumns, setPermittedColumns] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPermissions = async () => {
      if (!data || data.length === 0) {
        setLoading(false)
        return
      }

      const allColumns = Object.keys(data[0])
      const permitted = []

      for (const col of allColumns) {
        const hasPermission = await canViewColumn(userRole, tableName, col)
        if (hasPermission) {
          permitted.push(col)
        }
      }

      setPermittedColumns(permitted)
      setLoading(false)
    }

    loadPermissions()
  }, [userRole, tableName, data])

  const visibleColumns = permittedColumns.filter(col => !hiddenColumns.includes(col))

  const toggleColumn = (column: string) => {
    setHiddenColumns(prev =>
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  const showAllColumns = () => {
    setHiddenColumns([])
  }

  const hideAllColumns = () => {
    setHiddenColumns([...permittedColumns])
  }

  return {
    permittedColumns,
    visibleColumns,
    hiddenColumns,
    loading,
    toggleColumn,
    showAllColumns,
    hideAllColumns
  }
}