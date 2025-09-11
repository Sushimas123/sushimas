import React, { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { AlertTriangle, Search, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface NegativeDiscrepancy {
  id: number;
  tanggal: string;
  product: string;
  sub_category: string;
  cabang: string;
  selisih: number;
  ready: number;
  gudang: number;
  barang_masuk: number;
  waste: number;
  pemakaian: number;
  penjualan: number;
  total_production: number;
  status: string;
  notes?: string;
}

interface InvestigationNotes {
  id: number;
  analysis_id: number;
  notes: string;
  created_by: string;
  created_at: string;
}

const NegativeDiscrepancyDashboard: React.FC = () => {
  const [negativeData, setNegativeData] = useState<NegativeDiscrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<{ [key: number]: string }>({});
  const [savedNotes, setSavedNotes] = useState<InvestigationNotes[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    fetchNegativeDiscrepancies();
  }, [dateRange]);

  const fetchNegativeDiscrepancies = async () => {
    setLoading(true);
    try {
      // Fetch data analysis seperti di AnalysisPage
      const { data: readyData } = await supabase
        .from('ready')
        .select('*')
        .gte('tanggal_input', dateRange.startDate)
        .lte('tanggal_input', dateRange.endDate);

      // ... (sisa kode untuk fetch data lainnya seperti di AnalysisPage)

      // Process data dan filter hanya selisih minus
      // TODO: Implement proper data processing logic here
      const processedData: NegativeDiscrepancy[] = [];
      const negativeItems = processedData.filter((item: NegativeDiscrepancy) => item.selisih < 0);

      setNegativeData(negativeItems);
      
      // Load saved notes untuk item-item ini
      loadInvestigationNotes(negativeItems.map(item => item.id));
    } catch (error) {
      console.error('Error fetching negative discrepancies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvestigationNotes = async (analysisIds: number[]) => {
    if (analysisIds.length === 0) return;
    
    const { data, error } = await supabase
      .from('investigation_notes')
      .select('*')
      .in('analysis_id', analysisIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedNotes(data);
    }
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const saveNotes = async (id: number) => {
    if (!notes[id] || notes[id].trim() === '') return;

    const userData = localStorage.getItem('user');
    const user = userData ? JSON.parse(userData) : { name: 'Unknown' };

    const { error } = await supabase
      .from('investigation_notes')
      .insert({
        analysis_id: id,
        notes: notes[id],
        created_by: user.name || 'Unknown'
      });

    if (!error) {
      // Refresh notes
      loadInvestigationNotes([id]);
      setNotes(prev => ({ ...prev, [id]: '' }));
    }
  };

  const exportToExcel = () => {
    // Implementasi export Excel untuk data selisih minus
  };

  const getSeverityLevel = (selisih: number) => {
    const absoluteValue = Math.abs(selisih);
    if (absoluteValue > 100) return 'high';
    if (absoluteValue > 50) return 'medium';
    return 'low';
  };

  const filteredData = negativeData.filter(item => {
    const matchesCategory = !filterCategory || item.sub_category === filterCategory;
    const matchesBranch = !filterBranch || item.cabang === filterBranch;
    return matchesCategory && matchesBranch;
  });

  const categories = [...new Set(negativeData.map((item: NegativeDiscrepancy) => item.sub_category))];
  const branches = [...new Set(negativeData.map((item: NegativeDiscrepancy) => item.cabang))];

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-red-700 flex items-center">
            <AlertTriangle className="mr-2" />
            Investigasi Selisih Minus
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Total {filteredData.length} item dengan selisih negatif perlu investigasi
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
              className="border border-gray-300 px-3 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
              className="border border-gray-300 px-3 py-1 rounded text-sm"
            />
          </div>
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm flex items-center"
          >
            <Download size={16} className="mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Kategori</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 px-3 py-1 rounded text-sm"
          >
            <option value="">Semua Kategori</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cabang</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="border border-gray-300 px-3 py-1 rounded text-sm"
          >
            <option value="">Semua Cabang</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left"></th>
              <th className="p-2 text-left">Tanggal</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Kategori</th>
              <th className="p-2 text-left">Cabang</th>
              <th className="p-2 text-right">Selisih</th>
              <th className="p-2 text-right">Penjualan</th>
              <th className="p-2 text-right">Pemakaian</th>
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-4">
                  Loading data...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-500">
                  Tidak ada selisih minus pada periode yang dipilih
                </td>
              </tr>
            ) : (
              filteredData.map(item => (
                <React.Fragment key={item.id}>
                  <tr className={`border-b hover:bg-gray-50 ${
                    getSeverityLevel(item.selisih) === 'high' ? 'bg-red-50' : 
                    getSeverityLevel(item.selisih) === 'medium' ? 'bg-orange-50' : 'bg-yellow-50'
                  }`}>
                    <td className="p-2">
                      <button 
                        onClick={() => toggleExpand(item.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedItems.has(item.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                    <td className="p-2">{item.tanggal}</td>
                    <td className="p-2 font-medium">{item.product}</td>
                    <td className="p-2">{item.sub_category}</td>
                    <td className="p-2">{item.cabang}</td>
                    <td className="p-2 text-right text-red-600 font-bold">{item.selisih.toFixed(2)}</td>
                    <td className="p-2 text-right">{item.penjualan.toFixed(2)}</td>
                    <td className="p-2 text-right">{item.pemakaian.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.status === 'OK' ? 'bg-green-100 text-green-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                  
                  {/* Expanded row for details and notes */}
                  {expandedItems.has(item.id) && (
                    <tr className="bg-blue-50">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Detail Transaksi</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Ready Stock:</div>
                              <div className="text-right">{item.ready.toFixed(2)}</div>
                              
                              <div>Gudang:</div>
                              <div className="text-right">{item.gudang.toFixed(2)}</div>
                              
                              <div>Barang Masuk:</div>
                              <div className="text-right">{item.barang_masuk.toFixed(2)}</div>
                              
                              <div>Waste:</div>
                              <div className="text-right">{item.waste.toFixed(2)}</div>
                              
                              <div>Total Production:</div>
                              <div className="text-right">{item.total_production.toFixed(2)}</div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Catatan Investigasi</h4>
                            <div className="mb-3">
                              {savedNotes
                                .filter(note => note.analysis_id === item.id)
                                .map(note => (
                                  <div key={note.id} className="bg-white p-2 rounded border mb-2">
                                    <div className="text-xs text-gray-500">
                                      {note.created_by} - {new Date(note.created_at).toLocaleString()}
                                    </div>
                                    <div className="text-sm">{note.notes}</div>
                                  </div>
                                ))
                              }
                              
                              {savedNotes.filter(note => note.analysis_id === item.id).length === 0 && (
                                <div className="text-gray-500 text-sm">Belum ada catatan investigasi</div>
                              )}
                            </div>
                            
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={notes[item.id] || ''}
                                onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Tambah catatan investigasi..."
                                className="flex-1 border border-gray-300 px-3 py-1 rounded text-sm"
                              />
                              <button
                                onClick={() => saveNotes(item.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      {filteredData.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{filteredData.length}</div>
            <div className="text-sm text-gray-600">Total Item Minus</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'high').length}
            </div>
            <div className="text-sm text-gray-600">Kritis (Selisih &gt; 100)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'medium').length}
            </div>
            <div className="text-sm text-gray-600">Sedang (Selisih 50-100)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredData.filter(item => getSeverityLevel(item.selisih) === 'low').length}
            </div>
            <div className="text-sm text-gray-600">Ringan (Selisih &lt; 50)</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NegativeDiscrepancyDashboard;