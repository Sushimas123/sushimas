import { LucideIcon } from 'lucide-react'

export interface SubMenuItem {
  name: string
  href: string
  icon: LucideIcon
  pageName?: string
}

export interface MenuItem {
  id: string
  name: string
  href?: string
  icon: LucideIcon
  submenu?: SubMenuItem[]
  type?: string
  parent?: string
  pageName?: string
}

export interface BreadcrumbItem {
  name: string
  href: string
}

export interface SearchResult extends MenuItem {
  type: 'menu' | 'submenu'
  parent?: string
}

export enum AppRoutes {
  DASHBOARD = '/',
  READY_STOCK = '/ready',
  PRODUCTION = '/produksi',
  PRODUCTION_DETAIL = '/produksi_detail',
  SO_BATCH = '/stock_opname_batch',
  GUDANG = '/gudang',
  ESB = '/esb',
  PRODUCT_NAME = '/product_name',
  ANALYSIS = '/analysis',
  CATEGORIES = '/categories',
  RECIPES = '/recipes',
  SUPPLIER = '/supplier',
  BRANCHES = '/branches',
  USERS = '/users',
  PRODUCT_SETTINGS = '/product_settings',
  PERMISSIONS_DB = '/permissions-db',
  CRUD_PERMISSIONS = '/crud-permissions',
  AUDIT_LOG = '/audit-log',
  PRICE_HISTORY = '/price-history',
  TRANSFER_BARANG = '/transfer-barang',
  STOCK_ALERT = '/purchaseorder/stock-alert',
  FINANCE_PURCHASE_ORDERS = '/finance/purchase-orders',
  FINANCE_AGING_REPORT = '/finance/aging-report',
}