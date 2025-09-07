// Test component untuk memastikan column permissions bekerja
'use client'

import { useState, useEffect } from 'react'
import { canViewColumn, getVisibleColumns } from '@/src/utils/dbPermissions'

export default function TestColumnPermissions() {
  const [userRole, setUserRole] = useState('staff')
  const [testResults, setTestResults] = useState<any[]>([])

  const testColumns = ['sales_date', 'branch', 'product', 'price', 'total']
  
  useEffect(() => {
    const runTests = async () => {
      const results = []
      
      for (const role of ['super admin', 'admin', 'finance', 'pic_branch', 'staff']) {
        const visibleCols = await getVisibleColumns(role, 'esb', testColumns)
        const canViewPrice = await canViewColumn(role, 'esb', 'price')
        
        results.push({
          role,
          visibleColumns: visibleCols,
          canViewPrice,
          totalVisible: visibleCols.length
        })
      }
      
      setTestResults(results)
    }
    
    runTests()
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Column Permissions Test</h2>
      
      <table className="border w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Role</th>
            <th className="border p-2">Visible Columns</th>
            <th className="border p-2">Can View Price</th>
            <th className="border p-2">Total Visible</th>
          </tr>
        </thead>
        <tbody>
          {testResults.map(result => (
            <tr key={result.role}>
              <td className="border p-2 capitalize">{result.role}</td>
              <td className="border p-2">{result.visibleColumns.join(', ')}</td>
              <td className="border p-2">{result.canViewPrice ? 'Yes' : 'No'}</td>
              <td className="border p-2">{result.totalVisible}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}