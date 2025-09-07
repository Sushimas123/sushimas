import { useState } from 'react'
import { Settings, Eye, EyeOff } from 'lucide-react'

interface ColumnToggleProps {
  columns: string[]
  hiddenColumns: string[]
  onToggle: (column: string) => void
  onShowAll: () => void
  onHideAll: () => void
}

export default function ColumnToggle({ 
  columns, 
  hiddenColumns, 
  onToggle, 
  onShowAll, 
  onHideAll 
}: ColumnToggleProps) {
  const [showSelector, setShowSelector] = useState(false)

  const toTitleCase = (str: string) => {
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <>
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 text-xs flex items-center gap-1"
      >
        <Settings size={12} />
        {showSelector ? 'Hide Columns' : 'Show Columns'}
      </button>

      {showSelector && (
        <div className="bg-white p-3 rounded-lg shadow mb-4 border">
          <h3 className="font-medium text-gray-800 mb-2 text-sm">Column Visibility</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
            {columns.map(col => (
              <label key={col} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(col)}
                  onChange={() => onToggle(col)}
                  className="w-3 h-3"
                />
                <span className={hiddenColumns.includes(col) ? 'text-gray-500' : 'text-gray-800'}>
                  {toTitleCase(col)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onShowAll}
              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
            >
              <Eye size={10} />
              Show All
            </button>
            <button
              onClick={onHideAll}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1"
            >
              <EyeOff size={10} />
              Hide All
            </button>
          </div>
        </div>
      )}
    </>
  )
}