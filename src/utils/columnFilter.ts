import { canViewColumn } from './dbPermissions'
import { useState, useEffect } from 'react'

// Helper to filter table columns based on permissions
export const filterTableColumns = async (
  userRole: string, 
  tableName: string, 
  data: any[]
): Promise<string[]> => {
  if (!data || data.length === 0) return []
  
  const allColumns = Object.keys(data[0])
  const permittedColumns = []
  
  for (const col of allColumns) {
    const hasPermission = await canViewColumn(userRole, tableName, col)
    if (hasPermission) {
      permittedColumns.push(col)
    }
  }
  
  return permittedColumns
}

// Hook for React components
export const useColumnPermissions = (userRole: string, tableName: string, data: any[]) => {
  const [permittedColumns, setPermittedColumns] = useState<string[]>([])
  
  useEffect(() => {
    filterTableColumns(userRole, tableName, data).then(setPermittedColumns)
  }, [userRole, tableName, data])
  
  return permittedColumns
}