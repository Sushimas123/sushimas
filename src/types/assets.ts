export interface AssetCategory {
  category_id: number;
  category_name: string;
  category_type: 'KITCHEN' | 'DINING' | 'FURNITURE' | 'ELECTRONIC' | 'UTILITY';
  depreciation_rate: number;
  useful_life: number;
  created_at: string;
}

export interface Asset {
  asset_id: string;
  asset_name: string;
  category_id: number;
  id_branch?: number;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  supplier?: string;
  location: 'DAPUR' | 'RESTAURANT' | 'GUDANG' | 'KASIR' | 'OFFICE' | 'LOBBY' | 'TOILET';
  status: 'ACTIVE' | 'MAINTENANCE' | 'BROKEN' | 'SOLD' | 'LOST';
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'BROKEN';
  quantity?: number;
  photo_url?: string;
  warranty_expiry?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  asset_categories?: AssetCategory;
  branches?: { nama_branch: string; kode_branch: string; };
}

export interface AssetDamageJournal {
  journal_id: number;
  asset_id: string;
  damage_date: string;
  damaged_by: string;
  damage_description?: string;
  quantity_damaged: number;
  damage_value?: number;
  created_at?: string;
  assets?: Asset;
}

export interface AssetMaintenance {
  maintenance_id: number;
  asset_id: string;
  maintenance_date: string;
  maintenance_type: 'ROUTINE' | 'REPAIR' | 'OVERHAUL' | 'CLEANING';
  description?: string;
  cost: number;
  technician?: string;
  next_maintenance_date?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  assets?: Asset;
}