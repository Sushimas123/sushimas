'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Package, Plus, Search, Filter, Eye, Edit, Trash2, AlertTriangle, Tag, Menu, X, QrCode, Download, Camera } from 'lucide-react';
import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';
import { Asset, AssetCategory } from '@/src/types/assets';

// Custom hook untuk debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// QR Scanner Component
function QRScanner({ onScan, onClose }: {
  onScan: (result: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        setError('');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } // Use back camera if available
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsScanning(true);
        }
      } catch (err) {
        setError('Camera access denied or not available');
        console.error('Camera error:', err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleManualInput = () => {
    const input = prompt('Enter Asset ID manually:');
    if (input) {
      onScan(input.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">Scan QR Code</h3>
          
          {error ? (
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={handleManualInput}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-2"
              >
                Enter Asset ID Manually
              </button>
            </div>
          ) : (
            <div className="mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-64 bg-gray-200 rounded-lg object-cover"
              />
              {isScanning && (
                <p className="text-sm text-gray-600 mt-2">
                  Point camera at QR code or 
                  <button 
                    onClick={handleManualInput}
                    className="text-blue-600 underline ml-1"
                  >
                    enter manually
                  </button>
                </p>
              )}
            </div>
          )}
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// QR Code Generator Component
function QRCodeGenerator({ assetId, assetName, onClose }: { 
  assetId: string; 
  assetName: string;
  onClose: () => void;
}) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setLoading(true);
        
        // Method 1: Using external QR code service (more reliable)
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const assetUrl = `${baseUrl}/assets/${assetId}`;
        // Use only the URL for QR code to avoid encoding issues
        const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(assetUrl)}`;
        
        setQrCodeUrl(qrCodeImageUrl);
        
      } catch (error) {
        console.error('Error generating QR code:', error);
        
        // Fallback: Generate simple SVG QR (basic implementation)
        const svgQR = generateSimpleQR(assetId);
        setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svgQR)}`);
      } finally {
        setLoading(false);
      }
    };

    generateQRCode();
  }, [assetId, assetName]);

  const generateSimpleQR = (text: string) => {
    // Simple QR-like pattern (for fallback)
    return `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12">
          ${text}
        </text>
        <rect x="10" y="10" width="180" height="180" fill="none" stroke="black" stroke-width="2"/>
      </svg>
    `;
  };

  const handleDownload = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `QR-${assetId}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">QR Code - {assetName}</h3>
          
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4 flex justify-center">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt={`QR Code for ${assetName}`}
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-500">QR Code Error</span>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mb-2">Asset: {assetName}</p>
              <p className="text-sm text-gray-600 mb-2">ID: {assetId}</p>
              <p className="text-xs text-gray-500 mb-4 break-all">
                URL: {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/assets/{assetId}
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!qrCodeUrl}
                  className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<{url: string, name: string} | null>(null);
  const [selectedQR, setSelectedQR] = useState<{assetId: string, assetName: string} | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Handle QR scan result
  const handleQRScan = useCallback((scannedText: string) => {
    setShowScanner(false);
    
    // Clean the scanned text
    const cleanText = scannedText.trim();
    
    // Extract asset ID from scanned text
    let assetId = '';
    
    // Check if it's a URL (our new format)
    if (cleanText.includes('/assets/')) {
      const urlMatch = cleanText.match(/\/assets\/([A-Za-z0-9\-_]+)/);
      if (urlMatch) {
        assetId = urlMatch[1];
      }
    } else {
      // Assume the scanned text is the asset ID itself
      assetId = cleanText;
    }
    
    if (assetId) {
      // First try to find the asset
      const foundAsset = assets.find(asset => asset.asset_id === assetId);
      if (foundAsset) {
        // Navigate directly to asset detail
        window.location.href = `/assets/${assetId}`;
      } else {
        // If not found, set search term to show in search results
        setSearchTerm(assetId);
        alert(`Asset ${assetId} not found. Showing search results.`);
      }
    } else {
      alert('No valid Asset ID found in QR code');
    }
  }, [assets]);

  // Debounce search term untuk mengurangi rerender
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchData();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, locationFilter, branchFilter]);

  const fetchData = async () => {
    try {
      const [assetsData, categoriesData, branchesData] = await Promise.all([
        supabase
          .from('assets')
          .select(`
            *,
            asset_categories (
              category_name,
              category_type
            ),
            branches (
              nama_branch,
              kode_branch
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('asset_categories')
          .select('*')
          .order('category_name'),
        supabase
          .from('branches')
          .select('id_branch, nama_branch')
          .eq('is_active', true)
          .order('nama_branch')
      ]);

      if (assetsData.data) setAssets(assetsData.data);
      if (categoriesData.data) setCategories(categoriesData.data);
      if (branchesData.data) setBranches(branchesData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Optimized filtering dengan useMemo
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = asset.asset_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           asset.asset_id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           asset.brand?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = !statusFilter || asset.status === statusFilter;
      const matchesLocation = !locationFilter || asset.location === locationFilter;
      const matchesBranch = !branchFilter || asset.id_branch?.toString() === branchFilter;
      
      return matchesSearch && matchesStatus && matchesLocation && matchesBranch;
    });
  }, [assets, debouncedSearchTerm, statusFilter, locationFilter, branchFilter]);

  // Optimized status colors dengan useMemo
  const statusColors = useMemo(() => ({
    'ACTIVE': 'bg-green-100 text-green-800 border-green-200',
    'MAINTENANCE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'BROKEN': 'bg-red-100 text-red-800 border-red-200',
    'SOLD': 'bg-gray-100 text-gray-800 border-gray-200',
    'LOST': 'bg-red-100 text-red-800 border-red-200'
  }), []);

  const conditionColors = useMemo(() => ({
    'EXCELLENT': 'bg-green-100 text-green-800 border-green-200',
    'GOOD': 'bg-blue-100 text-blue-800 border-blue-200',
    'FAIR': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'POOR': 'bg-orange-100 text-orange-800 border-orange-200',
    'BROKEN': 'bg-red-100 text-red-800 border-red-200'
  }), []);

  const getStatusColor = (status: string) => statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
  const getConditionColor = (condition: string) => conditionColors[condition as keyof typeof conditionColors] || 'bg-gray-100 text-gray-800 border-gray-200';

  // Optimized update functions dengan useCallback
  const updateAssetStatus = useCallback(async (assetId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ status: newStatus })
        .eq('asset_id', assetId);

      if (error) throw error;

      setAssets(prev => prev.map(asset => 
        asset.asset_id === assetId ? { ...asset, status: newStatus as Asset['status'] } : asset
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  }, []);

  const updateAssetCondition = useCallback(async (assetId: string, newCondition: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ condition: newCondition })
        .eq('asset_id', assetId);

      if (error) throw error;

      setAssets(prev => prev.map(asset => 
        asset.asset_id === assetId ? { ...asset, condition: newCondition as Asset['condition'] } : asset
      ));
    } catch (error) {
      console.error('Error updating condition:', error);
      alert('Failed to update condition');
    }
  }, []);

  const handleDeleteAsset = useCallback(async (assetId: string, assetName: string) => {
    if (!confirm(`Are you sure you want to delete asset "${assetName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('asset_id', assetId);

      if (error) throw error;

      setAssets(prev => prev.filter(asset => asset.asset_id !== assetId));
      alert('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  }, []);

  // Pagination
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAssets = filteredAssets.slice(startIndex, startIndex + itemsPerPage);

  // Summary stats dengan useMemo - mengikuti hasil filter
  const summaryStats = useMemo(() => {
    const totalAssets = filteredAssets.length;
    const activeAssets = filteredAssets.filter(a => a.status === 'ACTIVE').length;
    const goodConditionAssets = filteredAssets.filter(a => ['EXCELLENT', 'GOOD'].includes(a.condition)).reduce((sum, a) => sum + (a.quantity || 1), 0);
    const totalValue = filteredAssets.reduce((sum, a) => sum + (a.current_value || 0), 0);

    return { totalAssets, activeAssets, goodConditionAssets, totalValue };
  }, [filteredAssets]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageAccessControl pageName="assets">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Asset Management</h1>
                <p className="text-sm text-gray-600">Manage restaurant assets</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg bg-gray-100"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            {/* Mobile Action Buttons */}
            {isMobileMenuOpen && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <a href="/assets/create" className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm">
                  <Plus size={16} />
                  Add Asset
                </a>
                <a href="/assets/maintenance" className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm">
                  <Package size={16} />
                  Maintenance
                </a>
                <a href="/assets/damage-journal" className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded text-sm">
                  <AlertTriangle size={16} />
                  Damage
                </a>
                <a href="/assets/categories" className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded text-sm">
                  <Tag size={16} />
                  Categories
                </a>
              </div>
            )}
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Asset Management</h1>
                <p className="text-gray-600">Manage restaurant assets and equipment</p>
              </div>
              <a href="/assets/create" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus size={16} />
                Add Asset
              </a>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <a href="/assets/maintenance" className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">
                <Package size={14} />
                <span>Maintenance</span>
              </a>
              <a href="/assets/damage-journal" className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">
                <AlertTriangle size={14} />
                <span>Damage Journal</span>
              </a>
              <a href="/assets/categories" className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">
                <Tag size={14} />
                <span>Categories</span>
              </a>
              <a href="/assets/locations" className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">
                <Filter size={14} />
                <span>Locations</span>
              </a>
            </div>
          </div>

          {/* Mobile Search & Filter */}
          <div className="lg:hidden space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets or scan QR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Scan QR Code"
                >
                  <Camera size={16} />
                </button>
              </div>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="px-3 py-2 border rounded-lg bg-white"
              >
                <Filter size={16} />
              </button>
            </div>

            {isFilterOpen && (
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="BROKEN">Broken</option>
                </select>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">All Locations</option>
                  <option value="DAPUR">Kitchen</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="GUDANG">Warehouse</option>
                </select>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Desktop Filters */}
          <div className="hidden lg:block bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets or scan QR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border rounded text-sm w-64"
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="px-3 py-2 border rounded text-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                  title="Scan QR Code"
                >
                  <Camera size={16} />
                  Scan
                </button>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="BROKEN">Broken</option>
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Locations</option>
                <option value="DAPUR">Kitchen</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="GUDANG">Warehouse</option>
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id_branch} value={branch.id_branch}>
                    {branch.nama_branch}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Assets List */}
          <div className="lg:hidden space-y-3">
            {paginatedAssets.map((asset) => (
              <div key={asset.asset_id} className="bg-white rounded-lg shadow p-4 space-y-3">
                {/* Asset Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {asset.photo_url ? (
                      <img 
                        src={asset.photo_url} 
                        alt={asset.asset_name}
                        className="w-16 h-16 rounded-lg object-cover border cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedPhoto({url: asset.photo_url!, name: asset.asset_name})}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border">
                        <Package size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{asset.asset_name}</div>
                      <div className="text-sm text-gray-500">{asset.asset_id}</div>
                      <div className="text-xs text-gray-400">{asset.brand} {asset.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setSelectedQR({assetId: asset.asset_id, assetName: asset.asset_name})}
                      className="p-1 text-purple-600 hover:text-purple-800"
                      title="Generate QR Code"
                    >
                      <QrCode size={16} />
                    </button>
                    <a href={`/assets/${asset.asset_id}`} className="p-1 text-blue-600 hover:text-blue-800">
                      <Eye size={16} />
                    </a>
                    <a href={`/assets/edit/${asset.asset_id}`} className="p-1 text-green-600 hover:text-green-800">
                      <Edit size={16} />
                    </a>
                    <button 
                      onClick={() => handleDeleteAsset(asset.asset_id, asset.asset_name)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Asset Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Category</div>
                    <div>{asset.asset_categories?.category_name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Location</div>
                    <div>{asset.location}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Value</div>
                    <div>Rp {asset.current_value?.toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Qty</div>
                    <div>{asset.quantity || 1}</div>
                  </div>
                </div>

                {/* Status & Condition */}
                <div className="flex gap-2">
                  <select
                    value={asset.status}
                    onChange={(e) => updateAssetStatus(asset.asset_id, e.target.value)}
                    className={`flex-1 px-2 py-1 text-xs rounded border ${getStatusColor(asset.status)} font-medium`}
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="BROKEN">Rusak</option>
                    <option value="SOLD">Dijual</option>
                    <option value="LOST">Hilang</option>
                  </select>
                  <select
                    value={asset.condition}
                    onChange={(e) => updateAssetCondition(asset.asset_id, e.target.value)}
                    className={`flex-1 px-2 py-1 text-xs rounded border ${getConditionColor(asset.condition)} font-medium`}
                  >
                    <option value="EXCELLENT">Sangat Baik</option>
                    <option value="GOOD">Baik</option>
                    <option value="FAIR">Cukup</option>
                    <option value="POOR">Kurang</option>
                    <option value="BROKEN">Rusak</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Assets Table */}
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <div className="max-h-[70vh] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Photo</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Asset Info</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category & Location</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Purchase Info</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Value & Qty</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Notes</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status & Condition</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedAssets.map((asset) => (
                    <tr key={asset.asset_id} className="hover:bg-gray-50">
                      {/* Photo */}
                      <td className="px-3 py-4">
                        {asset.photo_url ? (
                          <img 
                            src={asset.photo_url} 
                            alt={asset.asset_name}
                            className="w-16 h-16 rounded-lg object-cover border cursor-pointer hover:opacity-80"
                            onClick={() => setSelectedPhoto({url: asset.photo_url!, name: asset.asset_name})}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border">
                            <Package size={24} className="text-gray-400" />
                          </div>
                        )}
                      </td>
                      
                      {/* Asset Info */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{asset.asset_name}</div>
                          <div className="text-xs text-gray-500">{asset.brand} {asset.model}</div>
                          <div className="text-xs text-gray-500">{asset.asset_id}</div>
                        </div>
                      </td>
                      
                      {/* Category & Location */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">{asset.asset_categories?.category_name}</div>
                          <div className="text-xs text-gray-500">{asset.location}</div>
                          <div className="text-xs text-gray-500">{asset.branches?.nama_branch || '-'}</div>
                        </div>
                      </td>
                      
                      {/* Purchase Info */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            Rp {asset.purchase_price?.toLocaleString('id-ID') || '-'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('id-ID') : '-'}
                          </div>
                        </div>
                      </td>
                                            
                      {/* Value & Qty */}
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">
                            Rp {asset.current_value?.toLocaleString('id-ID')}
                          </div>
                          <div className="text-xs text-gray-500">Qty: {asset.quantity || 1}</div>
                        </div>
                      </td>
                      
                      {/* Notes */}
                      <td className="px-3 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={asset.notes || '-'}>
                          {asset.notes || '-'}
                        </div>
                      </td>
                      
                      {/* Status & Condition */}
                      <td className="px-3 py-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Status</label>
                            <select
                              value={asset.status}
                              onChange={(e) => updateAssetStatus(asset.asset_id, e.target.value)}
                              className={`w-full px-3 py-2 text-sm rounded-md border ${getStatusColor(asset.status)} font-medium`}
                            >
                              <option value="ACTIVE">Aktif</option>
                              <option value="MAINTENANCE">Maintenance</option>
                              <option value="BROKEN">Rusak</option>
                              <option value="SOLD">Dijual</option>
                              <option value="LOST">Hilang</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Kondisi</label>
                            <select
                              value={asset.condition}
                              onChange={(e) => updateAssetCondition(asset.asset_id, e.target.value)}
                              className={`w-full px-3 py-2 text-sm rounded-md border ${getConditionColor(asset.condition)} font-medium`}
                            >
                              <option value="EXCELLENT">Sangat Baik</option>
                              <option value="GOOD">Baik</option>
                              <option value="FAIR">Cukup</option>
                              <option value="POOR">Kurang</option>
                              <option value="BROKEN">Rusak</option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSelectedQR({assetId: asset.asset_id, assetName: asset.asset_name})}
                            className="text-purple-600 hover:text-purple-800" 
                            title="Generate QR Code"
                          >
                            <QrCode size={16} />
                          </button>
                          <a href={`/assets/${asset.asset_id}`} className="text-blue-600 hover:text-blue-800" title="View Details">
                            <Eye size={16} />
                          </a>
                          <a href={`/assets/edit/${asset.asset_id}`} className="text-green-600 hover:text-green-800" title="Edit Asset">
                            <Edit size={16} />
                          </a>
                          <button 
                            onClick={() => handleDeleteAsset(asset.asset_id, asset.asset_name)}
                            className="text-red-600 hover:text-red-800" 
                            title="Delete Asset"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAssets.length)} of {filteredAssets.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white rounded-lg shadow p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-gray-600">Total Assets</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">{summaryStats.totalAssets}</p>
                </div>
                <Package className="text-blue-600" size={20} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-gray-600">Active Assets</p>
                  <p className="text-lg lg:text-2xl font-bold text-green-600">{summaryStats.activeAssets}</p>
                </div>
                <Package className="text-green-600" size={20} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-gray-600">Good Condition</p>
                  <p className="text-lg lg:text-2xl font-bold text-green-600">{summaryStats.goodConditionAssets}</p>
                </div>
                <Package className="text-green-600" size={20} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-gray-600">Total Value</p>
                  <p className="text-lg lg:text-2xl font-bold text-blue-600">
                    Rp {summaryStats.totalValue.toLocaleString('id-ID')}
                  </p>
                </div>
                <Package className="text-blue-600" size={20} />
              </div>
            </div>
          </div>

          {/* Photo Preview Modal */}
          {selectedPhoto && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" 
              onClick={() => setSelectedPhoto(null)}
            >
              <div className="max-w-4xl max-h-full">
                <img 
                  src={selectedPhoto.url} 
                  alt={selectedPhoto.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
                <p className="text-white text-center mt-2">{selectedPhoto.name}</p>
              </div>
            </div>
          )}

          {/* QR Code Modal */}
          {selectedQR && (
            <QRCodeGenerator
              assetId={selectedQR.assetId}
              assetName={selectedQR.assetName}
              onClose={() => setSelectedQR(null)}
            />
          )}

          {/* QR Scanner Modal */}
          {showScanner && (
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setShowScanner(false)}
            />
          )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}