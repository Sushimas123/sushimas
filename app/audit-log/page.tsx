'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Eye, Download, RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout';
import * as XLSX from 'xlsx';
import PageAccessControl from '../../components/PageAccessControl';

interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  user_id: string | null; // Changed to string for UUID
  user_name: string;
  old_values: any;
  new_values: any;
  created_at: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [exporting, setExporting] = useState(false);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tableFilter, actionFilter, userFilter, dateRange]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Create date objects with proper timezone handling
      const startDate = new Date(dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      let query = supabase
        .from('audit_log_view')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500); // Reduced limit for better performance

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleExport = async () => {
    if (filteredLogs.length === 0) return;
    
    setExporting(true);
    try {
      // For large datasets, consider streaming or paginated export
      const exportData = filteredLogs.map(log => ({
        'Date': new Date(log.created_at).toLocaleString(),
        'Table': log.table_name,
        'Record ID': log.record_id,
        'Action': log.action,
        'User': log.user_name,
        'Old Values': JSON.stringify(log.old_values),
        'New Values': JSON.stringify(log.new_values)
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
      XLSX.writeFile(wb, `audit_log_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = !tableFilter || log.table_name === tableFilter;
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesUser = !userFilter || 
      (log.user_name && log.user_name.toLowerCase().includes(userFilter.toLowerCase()));
    
    return matchesSearch && matchesTable && matchesAction && matchesUser;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueTables = [...new Set(logs.map(log => log.table_name))];
  const uniqueActions = [...new Set(logs.map(log => log.action))];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <PageAccessControl pageName="audit-log">
        <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">📋 Audit Trail Log</h1>
          <div className="flex gap-2">
            <button
              onClick={fetchAuditLogs}
              disabled={loading}
              className="bg-gray-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || filteredLogs.length === 0}
              className="bg-green-600 text-white px-3 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
                className="border px-3 py-2 rounded-md text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
                className="border px-3 py-2 rounded-md text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Table</label>
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="border px-3 py-2 rounded-md text-sm w-full"
              >
                <option value="">All Tables</option>
                {uniqueTables.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="border px-3 py-2 rounded-md text-sm w-full"
              >
                <option value="">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Search by table, user, or action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-3 py-2 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Filter by user name..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="border px-3 py-2 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Date/Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Table</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Record ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span>Loading audit logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {logs.length === 0 ? 'No audit logs found' : 'No logs match your filters'}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-gray-900">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{log.table_display || log.table_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900">{log.record_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                          {log.action_display || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{log.user_full_name || log.user_name || 'N/A'}</div>
                        {log.user_email && (
                          <div className="text-gray-500 text-xs">{log.user_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
            </p>
            <div className="flex gap-1">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(1)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
              >
                First
              </button>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 border rounded text-sm bg-blue-50">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
              >
                Next
              </button>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(totalPages)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Audit Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date/Time</label>
                  <p className="text-sm text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">User</label>
                  <p className="text-sm text-gray-900">{selectedLog.user_name || 'N/A'} {selectedLog.user_id && `(ID: ${selectedLog.user_id})`}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Table</label>
                  <p className="text-sm text-gray-900">{selectedLog.table_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Action</label>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
              </div>

              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Old Values</label>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Values</label>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </PageAccessControl>
    </Layout>
  );
}