import React from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MenuItem } from '@/types/layout'

interface SidebarItemProps {
  item: MenuItem
  isActive: boolean
  activeSubmenu: string | null
  onToggleSubmenu: (menuId: string) => void
  onCloseSidebar: () => void
}

const SidebarItem = React.memo(({ 
  item, 
  isActive, 
  activeSubmenu, 
  onToggleSubmenu, 
  onCloseSidebar 
}: SidebarItemProps) => {
  if (item.submenu) {
    return (
      <div>
        <button
          onClick={() => onToggleSubmenu(item.id)}
          className={`group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
            ${activeSubmenu === item.id || item.submenu.some(sub => isActive) 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
        >
          <item.icon
            size={18}
            className={`mr-3 flex-shrink-0 
              ${activeSubmenu === item.id || item.submenu.some(sub => isActive)
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
              }`}
          />
          <span className="flex-1 text-left">{item.name}</span>
          {activeSubmenu === item.id ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </button>
        
        {activeSubmenu === item.id && (
          <div className="mt-1 ml-4 space-y-1">
            {item.submenu.map((subItem) => (
              <Link
                key={subItem.href}
                href={subItem.href}
                onClick={onCloseSidebar}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
              >
                <subItem.icon
                  size={16}
                  className={`mr-3 flex-shrink-0 
                    ${isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400'
                    }`}
                />
                {subItem.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href!}
      onClick={onCloseSidebar}
      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
        ${isActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
    >
      <item.icon
        size={18}
        className={`mr-3 flex-shrink-0 
          ${isActive
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
          }`}
      />
      {item.name}
    </Link>
  )
})

SidebarItem.displayName = 'SidebarItem'

export default SidebarItem