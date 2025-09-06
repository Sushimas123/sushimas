'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabaseClient";
import { Plus, Edit, Trash2, Download, Upload, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { canViewColumn } from '@/src/utils/columnPermissions';
import { getBranchFilter, getAllowedBranches } from '@/src/utils/branchAccess';

interface Ready {
  id_ready: number;
  ready_no: string;
  tanggal_input: string;
  id_product: number;
  ready: number;
  waste: number;
  sub_category: string;
  id_branch: number;
  product_name?: string;
  branch_name?: string;
}

interface Product {
  id_product: number;
  product_name: string;
  sub_category: string;
}

interface Branch {
  id_branch: number;
  nama_branch: string;
}

interface FormProduct {
  id_product: number;
  product_name: string;
  ready: string;
  waste: string;
}

export default function ReadyPage() {
  const router = useRouter();
  const [ready, setReady] = useState<Ready[]>([]);
  const [menuProducts, setMenuProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['bahan baku', 'wip']);
  const [formProducts, setFormProducts] = useState<FormProduct[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [editingItem, setEditingItem] = useState<Ready | null>(null);
  const [importProgress, setImportProgress] = useState<{show: boolean, progress: number, message: string}>({show: false, progress: 0, message: ''});
  const [showDataTable, setShowDataTable] = useState(false);
  const [requireReadyInput, setRequireReadyInput] = useState(true);
  const [userRole, setUserRole] = useState<string>('guest');

  // Get user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || 'guest')
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      await fetchReady();
      await fetchSubCategories();
      await fetchBranches();
      await fetchCategories();
    };
    loadData();
  }, []);

  // Fetch products when categories change
  useEffect(() => {
    if (selectedCategories.length > 0) {
      fetchMenuProducts();
    }
  }, [selectedCategories]);

  useEffect(() => {
    if (selectedSubCategory && menuProducts.length > 0) {
      // Filter by sub category
      const products = menuProducts.filter(p => {
        const normalizedProductCategory = p.sub_category.toLowerCase().replace(/^wip\s+/, '');
        const normalizedSelectedCategory = selectedSubCategory.toLowerCase();
        return normalizedProductCategory === normalizedSelectedCategory;
      });
      
      // Sort products: non-WIP first, then WIP
      const sortedProducts = products.sort((a, b) => {
        const aIsWIP = a.sub_category.toLowerCase().startsWith('wip');
        const bIsWIP = b.sub_category.toLowerCase().startsWith('wip');
        
        if (aIsWIP && !bIsWIP) return 1;
        if (!aIsWIP && bIsWIP) return -1;
        return a.product_name.localeCompare(b.product_name);
      });
      
      setFormProducts(sortedProducts.map(p => ({
        id_product: p.id_product,
        product_name: p.product_name,
        ready: '',
        waste: ''
      })));
    } else {
      setFormProducts([]);
    }
  }, [selectedSubCategory, menuProducts]);

  const generateReadyNo = async () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const datePrefix = `RDY${year}${month}${day}`;
    
    // Get existing ready numbers for today
    const { data: existing } = await supabase
      .from('ready')
      .select('ready_no')
      .like('ready_no', `${datePrefix}%`);
    
    const existingNumbers = new Set(existing?.map(r => r.ready_no) || []);
    
    // Find next available number
    let counter = 1;
    let readyNo;
    do {
      readyNo = `${datePrefix}${counter.toString().padStart(3, '0')}`;
      counter++;
    } while (existingNumbers.has(readyNo));
    
    return readyNo;
  };

  const fetchReady = async () => {
    try {
      // Fetch all data in parallel - only filter display data, not calculation data
      const [readyData, productsData, branchesData] = await Promise.all([
        supabase.from('ready').select('*').order('tanggal_input', { ascending: false }),
        supabase.from('nama_product').select('id_product, product_name'),
        supabase.from('branches').select('id_branch, nama_branch')
      ]);

      if (readyData.error) throw readyData.error;
      
      // Create lookup maps for O(1) access
      const productMap = new Map(productsData.data?.map(p => [p.id_product, p.product_name]) || []);
      const branchMap = new Map(branchesData.data?.map(b => [b.id_branch, b.nama_branch]) || []);
      
      // Transform data using lookup maps
      let readyWithNames = (readyData.data || []).map((item: any) => ({
        ...item,
        product_name: productMap.get(item.id_product) || '',
        branch_name: branchMap.get(item.id_branch) || ''
      }));
      
      // Apply branch filter only for display (not for calculations)
      const userBranchFilter = getBranchFilter();
      if (userBranchFilter) {
        readyWithNames = readyWithNames.filter(item => 
          item.branch_name === userBranchFilter
        );
      }
      
      setReady(readyWithNames);
    } catch (error) {
      console.error('Error fetching ready:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id_branch, nama_branch')
        .eq('is_active', true)
        .order('nama_branch');
      
      if (error) throw error;
      // Filter branches based on user access
      const filteredBranches = getAllowedBranches(data || []);
      setBranches(filteredBranches);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchMenuProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('id_product, product_name, sub_category, category')
        .in('category', selectedCategories)
        .order('product_name');
      
      if (error) throw error;
      setMenuProducts(data || []);
    } catch (error) {
      console.error('Error fetching menu products:', error);
    }
  };

  const fetchSubCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('sub_category')
        .not('sub_category', 'is', null);
      
      if (error) throw error;
      
      const rawCategories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))] as string[];
      
      // Group WIP categories with their main categories
      const groupedCategories = rawCategories.reduce((acc, category) => {
        const normalizedCategory = category.toLowerCase().replace(/^wip\s+/, '');
        const displayName = normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);
        
        if (!acc.includes(displayName)) {
          acc.push(displayName);
        }
        return acc;
      }, [] as string[]);
      
      setSubCategories(groupedCategories.sort());
    } catch (error) {
      console.error('Error fetching sub categories:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('nama_product')
        .select('category')
        .not('category', 'is', null);
      
      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(item => item.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories.sort());
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(['bahan baku', 'wip', 'menu']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch || !selectedDate || !selectedSubCategory) {
      alert('Cabang, Tanggal, dan Sub Category wajib diisi');
      return;
    }

    // Check if all products have ready values filled (waste is optional) - only if required
    if (requireReadyInput) {
      const hasEmptyReadyFields = formProducts.some(product => 
        product.ready === ''
      );
      
      if (hasEmptyReadyFields) {
        alert('Semua field Ready harus diisi!');
        return;
      }
    }

    const readyNo = await generateReadyNo();
    const submitData = formProducts
      .filter(product => parseFloat(product.ready) > 0) // Only save products with ready > 0
      .map(product => ({
        ready_no: readyNo,
        tanggal_input: selectedDate,
        id_product: product.id_product,
        ready: parseFloat(product.ready),
        waste: parseFloat(product.waste) || 0,
        sub_category: selectedSubCategory,
        id_branch: parseInt(selectedBranch)
      }));
    
    if (submitData.length === 0) {
      alert('Tidak ada produk dengan Ready > 0 untuk disimpan!');
      return;
    }

    try {
      const { error } = await supabase
        .from('ready')
        .insert(submitData);
      if (error) throw error;
      
      alert('Ready data berhasil disimpan!');
      resetForm();
      await fetchReady();
    } catch (error) {
      console.error('Error saving ready:', error);
      alert('Gagal menyimpan ready data');
    }
  };

  const resetForm = () => {
    setSelectedBranch('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedSubCategory('');
    setFormProducts([]);
    setShowAddForm(false);
    setEditingId(null);
  };

  const updateProductValue = (productId: number, field: 'ready' | 'waste', value: string) => {
    setFormProducts(prev => prev.map(p => 
      p.id_product === productId ? { ...p, [field]: value } : p
    ));
  };

  const handleEdit = (item: Ready) => {
    setEditingItem(item);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('ready')
        .update({
          ready: editingItem.ready,
          waste: editingItem.waste
        })
        .eq('id_ready', editingItem.id_ready);
      
      if (error) throw error;
      
      alert('Data berhasil diupdate!');
      setEditingItem(null);
      await fetchReady();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Gagal mengupdate data');
    }
  };



  const handleSelectAll = () => {
    if (selectedItems.length === paginatedReady.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedReady.map(item => item.id_ready));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Hapus ${selectedItems.length} data yang dipilih?`)) return;
    
    try {
      const { error } = await supabase
        .from('ready')
        .delete()
        .in('id_ready', selectedItems);
      if (error) throw error;
      
      setSelectedItems([]);
      await fetchReady();
      alert(`${selectedItems.length} data berhasil dihapus!`);
    } catch (error) {
      console.error('Error deleting selected items:', error);
      alert('Gagal menghapus data yang dipilih');
    }
  };

  const handleItemSelect = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportProgress({show: true, progress: 10, message: 'Membaca file Excel...'});
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        setImportProgress({show: false, progress: 0, message: ''});
        alert('File Excel kosong!');
        return;
      }
      
      setImportProgress({show: true, progress: 20, message: 'Validasi data...'});

      // Validate required columns - prioritize Product ID over Product name
      const requiredColumns = ['Ready No', 'Tanggal', 'Cabang', 'Sub Category', 'Ready'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      // Check if we have either Product ID or Product name
      const hasProductId = 'Product ID' in firstRow;
      const hasProductName = 'Product' in firstRow;
      
      if (!hasProductId && !hasProductName) {
        missingColumns.push('Product ID atau Product');
      }
      
      if (missingColumns.length > 0) {
        setImportProgress({show: false, progress: 0, message: ''});
        alert(`Kolom yang hilang: ${missingColumns.join(', ')}`);
        return;
      }

      // Filter out empty rows and check for duplicates
      const validRows = [];
      const originalRowNumbers = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const readyNo = row['Ready No'];
        
        // Check if row has valid Ready No and other required fields
        const hasValidProduct = (row['Product ID'] && row['Product ID'].toString().trim() !== '') || 
                               (row['Product'] && row['Product'].toString().trim() !== '');
        
        if (readyNo && 
            readyNo.toString().trim() !== '' && 
            row['Tanggal'] && 
            row['Cabang'] && 
            row['Sub Category'] && 
            hasValidProduct && 
            row['Ready'] !== undefined && 
            row['Ready'] !== null && 
            row['Ready'].toString().trim() !== '') {
          validRows.push(row);
          originalRowNumbers.push(i + 1); // Excel row numbers start from 1
        }
      }
      
      if (validRows.length === 0) {
        setImportProgress({show: false, progress: 0, message: ''});
        alert('Tidak ada data valid untuk diimport!');
        return;
      }
      
      setImportProgress({show: true, progress: 30, message: 'Mengecek duplikasi...'});
      
      // Debug: Log first few Ready No values
      console.log('First 5 Ready No values:', validRows.slice(0, 5).map(row => row['Ready No']));
      
      // Check for duplicates in current import - Ready No can be same for one batch
      // Only check for duplicate combinations of Ready No + Product within the same import
      const seenCombinations = new Map();
      const duplicateRows = [];
      const duplicateDetails = [];
      
      for (let i = 0; i < validRows.length; i++) {
        const readyNo = validRows[i]['Ready No'].toString().trim();
        // Use Product ID if available, otherwise use Product name
        const productIdentifier = validRows[i]['Product ID'] ? 
          validRows[i]['Product ID'].toString().trim() : 
          validRows[i]['Product'].toString().trim();
        const combination = `${readyNo}|${productIdentifier}`;
        
        if (seenCombinations.has(combination)) {
          // This is a true duplicate - same Ready No + same Product
          const firstOccurrence = seenCombinations.get(combination);
          duplicateRows.push(originalRowNumbers[i]);
          duplicateDetails.push({
            row: originalRowNumbers[i],
            firstRow: firstOccurrence,
            readyNo,
            product: productIdentifier
          });
        } else {
          seenCombinations.set(combination, originalRowNumbers[i]);
        }
      }
      
      if (duplicateRows.length > 0) {
        setImportProgress({show: false, progress: 0, message: ''});
        
        // Show detailed duplicate information
        const sampleDuplicates = duplicateDetails.slice(0, 5);
        const duplicateInfo = sampleDuplicates.map(d => 
          `Baris ${d.row}: ${d.readyNo} + ${d.product} (sama dengan baris ${d.firstRow})`
        ).join('\n');
        
        const totalDuplicates = duplicateRows.length;
        const message = `Ditemukan ${totalDuplicates} duplikasi dalam file Excel:\n\n${duplicateInfo}${totalDuplicates > 5 ? `\n\n...dan ${totalDuplicates - 5} duplikasi lainnya` : ''}\n\nApakah Anda ingin:\n1. Perbaiki file Excel dan import ulang\n2. Skip duplikasi dan import data unik saja`;
        
        const skipDuplicates = confirm(message + '\n\nKlik OK untuk skip duplikasi, Cancel untuk batal import');
        
        if (!skipDuplicates) {
          return;
        }
        
        // Remove duplicates and continue
        const uniqueRows = [];
        const uniqueOriginalRows = [];
        const seenUnique = new Set();
        
        for (let i = 0; i < validRows.length; i++) {
          const readyNo = validRows[i]['Ready No'].toString().trim();
          const productIdentifier = validRows[i]['Product ID'] ? 
            validRows[i]['Product ID'].toString().trim() : 
            validRows[i]['Product'].toString().trim();
          const combination = `${readyNo}|${productIdentifier}`;
          
          if (!seenUnique.has(combination)) {
            seenUnique.add(combination);
            uniqueRows.push(validRows[i]);
            uniqueOriginalRows.push(originalRowNumbers[i]);
          }
        }
        
        validRows.length = 0;
        validRows.push(...uniqueRows);
        originalRowNumbers.length = 0;
        originalRowNumbers.push(...uniqueOriginalRows);
        
        alert(`Duplikasi di-skip. Akan mengimport ${validRows.length} data unik dari ${validRows.length + totalDuplicates} total data.`);
      }

      // Check for duplicates in database - check Ready No + Product ID combinations
      setImportProgress({show: true, progress: 40, message: 'Mengecek database...'});
      
      const readyNos = [...new Set(validRows.map(row => row['Ready No'].toString().trim()))];
      const { data: existingData } = await supabase
        .from('ready')
        .select('ready_no, id_product')
        .in('ready_no', readyNos);
      
      if (existingData && existingData.length > 0) {
        // Check if any combination already exists
        const existingCombinations = new Set(existingData.map(item => `${item.ready_no}|${item.id_product}`));
        const duplicateCombinations = [];
        
        for (const row of validRows) {
          const readyNo = row['Ready No'].toString().trim();
          // We'll get the product ID during processing, so skip duplicate check here if using product name
          if (row['Product ID']) {
            const productId = row['Product ID'].toString().trim();
            const combination = `${readyNo}|${productId}`;
            
            if (existingCombinations.has(combination)) {
              duplicateCombinations.push(`${readyNo} - Product ID ${productId}`);
            }
          }
        }
        
        if (duplicateCombinations.length > 0) {
          setImportProgress({show: false, progress: 0, message: ''});
          alert(`Kombinasi Ready No + Product ID sudah ada di database: ${duplicateCombinations.slice(0, 5).join(', ')}${duplicateCombinations.length > 5 ? ` dan ${duplicateCombinations.length - 5} lainnya` : ''}`);
          return;
        }
      }

      // Load all products for import validation (not filtered by category)
      setImportProgress({show: true, progress: 45, message: 'Memuat data produk...'});
      
      const { data: allProducts, error: productsError } = await supabase
        .from('nama_product')
        .select('id_product, product_name, sub_category, category');
      
      if (productsError) {
        setImportProgress({show: false, progress: 0, message: ''});
        alert(`Error memuat produk: ${productsError.message}`);
        return;
      }
      
      // Process and validate data
      setImportProgress({show: true, progress: 50, message: 'Memproses data...'});
      
      const processedData = [];
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const progress = 50 + (i / validRows.length) * 30;
        setImportProgress({show: true, progress, message: `Memproses baris ${i + 1} dari ${validRows.length}...`});
        
        // Find branch ID
        const branch = branches.find(b => b.nama_branch === row['Cabang']);
        if (!branch) {
          setImportProgress({show: false, progress: 0, message: ''});
          alert(`Cabang '${row['Cabang']}' tidak ditemukan!`);
          return;
        }

        // Find product ID - prioritize Product ID over Product name
        let productId;
        if (row['Product ID']) {
          // Use Product ID directly
          productId = parseInt(row['Product ID']);
          // Verify product exists in all products (not just filtered ones)
          const product = allProducts?.find(p => p.id_product === productId);
          if (!product) {
            setImportProgress({show: false, progress: 0, message: ''});
            alert(`Product dengan ID '${productId}' tidak ditemukan!`);
            return;
          }
        } else {
          // Use Product name to find ID in all products
          const product = allProducts?.find(p => p.product_name === row['Product']);
          if (!product) {
            setImportProgress({show: false, progress: 0, message: ''});
            alert(`Product '${row['Product']}' tidak ditemukan!`);
            return;
          }
          productId = product.id_product;
        }

        // Convert Excel date using proper Excel date conversion
        let tanggalInput;
        if (typeof row['Tanggal'] === 'number') {
          // Excel stores dates as numbers (days since 1900-01-01)
          // Use XLSX utility to convert Excel serial date to JS Date
          const jsDate = XLSX.SSF.parse_date_code(row['Tanggal']);
          if (jsDate) {
            tanggalInput = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`;
          } else {
            // Fallback: manual conversion for Excel serial dates
            const excelEpoch = new Date(1900, 0, 1);
            const jsDate = new Date(excelEpoch.getTime() + (row['Tanggal'] - 2) * 24 * 60 * 60 * 1000);
            tanggalInput = jsDate.toISOString().split('T')[0];
          }
        } else if (row['Tanggal'] instanceof Date) {
          // Direct Date object - use UTC to avoid timezone issues
          const utcDate = new Date(row['Tanggal'].getTime() + (row['Tanggal'].getTimezoneOffset() * 60000));
          tanggalInput = utcDate.toISOString().split('T')[0];
        } else {
          // String date - parse and convert
          const parsedDate = new Date(row['Tanggal']);
          if (isNaN(parsedDate.getTime())) {
            setImportProgress({show: false, progress: 0, message: ''});
            alert(`Format tanggal tidak valid di baris ${i + 1}: ${row['Tanggal']}`);
            return;
          }
          // Use UTC to avoid timezone offset
          const utcDate = new Date(parsedDate.getTime() + (parsedDate.getTimezoneOffset() * 60000));
          tanggalInput = utcDate.toISOString().split('T')[0];
        }
        
        console.log(`Converting date: ${row['Tanggal']} (type: ${typeof row['Tanggal']}) -> ${tanggalInput}`);

        processedData.push({
          ready_no: row['Ready No'],
          tanggal_input: tanggalInput,
          id_product: productId,
          ready: parseFloat(row['Ready']) || 0,
          waste: parseFloat(row['Waste']) || 0,
          sub_category: row['Sub Category'],
          id_branch: branch.id_branch
        });
      }

      // Insert data
      setImportProgress({show: true, progress: 85, message: 'Menyimpan ke database...'});
      
      const { error } = await supabase
        .from('ready')
        .insert(processedData);
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Database error: ${error.message || 'Failed to insert data'}`);
      }
      
      setImportProgress({show: true, progress: 95, message: 'Memperbarui tampilan...'});
      await fetchReady();
      
      setImportProgress({show: true, progress: 100, message: 'Selesai!'});
      
      setTimeout(() => {
        setImportProgress({show: false, progress: 0, message: ''});
        alert(`${processedData.length} data berhasil diimport!`);
      }, 500);
      
    } catch (error) {
      setImportProgress({show: false, progress: 0, message: ''});
      console.error('Error importing Excel:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Gagal mengimport file Excel: ${errorMessage}`);
    }
    
    // Reset file input
    e.target.value = '';
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedReady = (() => {
    let filtered = ready.filter(item => {
      const matchesSearch = item.ready_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sub_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || item.tanggal_input.includes(dateFilter);
      const matchesSubCategory = !subCategoryFilter || item.sub_category.toLowerCase().includes(subCategoryFilter.toLowerCase());
      const matchesBranch = !branchFilter || (item.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase());
      
      return matchesSearch && matchesDate && matchesSubCategory && matchesBranch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof Ready];
        let bValue = b[sortConfig.key as keyof Ready];
        
        if (aValue === undefined) aValue = '';
        if (bValue === undefined) bValue = '';
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  })();

  const totalPages = Math.ceil(filteredAndSortedReady.length / itemsPerPage);
  const paginatedReady = filteredAndSortedReady.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToExcel = () => {
    const exportData = filteredAndSortedReady.map(item => ({
      'Ready No': item.ready_no,
      'Tanggal': item.tanggal_input,
      'Cabang': item.branch_name,
      'Sub Category': item.sub_category,
      'Product ID': item.id_product,
      'Product': item.product_name,
      'Ready': item.ready,
      'Waste': item.waste
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ready Stock');
    XLSX.writeFile(wb, `ready_stock_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="animate-spin h-8 w-8" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Add Form */}
        {showAddForm && (
          <div className="mb-6 bg-white p-4 shadow rounded-lg">
            <h2 className="font-semibold text-base mb-4 text-gray-800">
              🍽️ Input Ready Stock Harian
            </h2>
            
            <form onSubmit={handleSubmit}>
              {/* Selection Form */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">Cabang *</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    required
                  >
                    <option value="">Pilih Cabang</option>
                    {branches.map(branch => (
                      <option key={branch.id_branch} value={branch.id_branch}>
                        {branch.nama_branch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">Tanggal *</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">Category Filter</label>
                  <div className="border rounded-md p-2 max-h-20 overflow-y-auto bg-white">
                    {categories.map(cat => (
                      <label key={cat} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories(prev => [...prev, cat])
                            } else {
                              setSelectedCategories(prev => prev.filter(c => c !== cat))
                            }
                          }}
                          className="w-3 h-3"
                        />
                        <span className="capitalize">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700">Sub Category *</label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    className="border px-2 py-1 rounded-md text-xs w-full"
                    required
                  >
                    <option value="">Pilih Sub Category</option>
                    {subCategories.map(subCat => (
                      <option key={subCat} value={subCat}>{subCat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Products Form */}
              {formProducts.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-sm mb-2">Input Ready & Waste untuk {selectedSubCategory}</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-2 py-1 text-left">Product Name</th>
                          <th className="border px-2 py-1 text-center">Ready *</th>
                          <th className="border px-2 py-1 text-center">Waste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formProducts.map((product, idx) => {
                          const currentProduct = menuProducts.find(p => p.id_product === product.id_product);
                          const isWIP = currentProduct?.sub_category.toLowerCase().startsWith('wip');
                          const prevProduct = idx > 0 ? menuProducts.find(p => p.id_product === formProducts[idx - 1].id_product) : null;
                          const prevIsWIP = prevProduct?.sub_category.toLowerCase().startsWith('wip');
                          const showSeparator = idx > 0 && isWIP && !prevIsWIP;
                          
                          return (
                            <React.Fragment key={`product-${product.id_product}`}>
                              {showSeparator && (
                                <tr key={`separator-${idx}`}>
                                  <td colSpan={3} className="border px-2 py-1 bg-gray-200 text-center font-medium text-gray-600">
                                    WIP Products
                                  </td>
                                </tr>
                              )}
                              <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="border px-2 py-1">
                                  {isWIP && <span className="text-orange-600 font-medium">WIP </span>}
                                  {product.product_name}
                                </td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                value={product.ready}
                                onChange={(e) => updateProductValue(product.id_product, 'ready', e.target.value)}
                                className="w-full text-center border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1"
                                placeholder="0"
                                required={requireReadyInput}
                              />
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                value={product.waste}
                                onChange={(e) => updateProductValue(product.id_product, 'waste', e.target.value)}
                                className="w-full text-center border-0 bg-transparent focus:bg-white focus:border focus:rounded px-1"
                                placeholder="0"
                              />
                            </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={formProducts.length === 0 || (requireReadyInput && formProducts.some(p => p.ready === ''))}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md text-xs"
                >
                  Simpan Semua
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="font-semibold text-lg mb-4">Edit Ready Stock</h3>
              <form onSubmit={handleUpdateItem}>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Product</label>
                  <input type="text" value={editingItem.product_name} disabled className="w-full px-3 py-2 border rounded bg-gray-100" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Ready *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.ready}
                    onChange={(e) => setEditingItem({...editingItem, ready: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Waste</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.waste}
                    onChange={(e) => setEditingItem({...editingItem, waste: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                    Update
                  </button>
                  <button type="button" onClick={() => setEditingItem(null)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Progress Modal */}
        {importProgress.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="font-semibold text-lg mb-4">Import Excel</h3>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{importProgress.message}</span>
                  <span>{Math.round(importProgress.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.progress}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-center">
                <RefreshCw className="animate-spin h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">🍽️ Ready Stock</h1>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-600">Access Level:</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              userRole === 'admin' ? 'bg-red-100 text-red-800' :
              userRole === 'manager' ? 'bg-blue-100 text-blue-800' :
              userRole === 'pic_branch' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {userRole.toUpperCase()}
            </span>
            {(userRole === 'admin' || userRole === 'manager') && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={requireReadyInput}
                  onChange={(e) => setRequireReadyInput(e.target.checked)}
                  className="w-3 h-3"
                />
                Wajib isi Ready
              </label>
            )}
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              {showDataTable ? 'Hide' : 'Show'} Data Table
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder="🔍 Search ready stock..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-2 py-1 rounded-md text-xs w-full sm:w-64"
          />
          
          <div className="flex flex-wrap gap-2">
            {(userRole === 'admin' || userRole === 'manager' || userRole === 'pic_branch') && (
              <div
                onClick={() => {
                  console.log('Input Harian clicked');
                  setShowAddForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowAddForm(true);
                  }
                }}
              >
                <Plus size={16} />
                Input Harian
              </div>
            )}
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <Download size={16} />
              Export Excel
            </button>
            {(userRole === 'admin' || userRole === 'manager') && (
              <label className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer">
                <Upload size={16} />
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>
            )}
            <button
              onClick={() => {
                fetchReady()
                fetchBranches()
                fetchMenuProducts()
                fetchSubCategories()
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {selectedItems.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"
              >
                <Trash2 size={16} />
                Delete ({selectedItems.length})
              </button>
            )}
          </div>
        </div>

        {/* Data Table Section */}
        {showDataTable && (
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border px-2 py-1 rounded-md text-xs"
                />
                <input
                  type="text"
                  placeholder="Filter Sub Category"
                  value={subCategoryFilter}
                  onChange={(e) => setSubCategoryFilter(e.target.value)}
                  className="border px-2 py-1 rounded-md text-xs"
                />
                <input
                  type="text"
                  placeholder="Filter Cabang"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="border px-2 py-1 rounded-md text-xs"
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="w-full text-xs border border-gray-200">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="border px-2 py-1 text-center font-medium">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === paginatedReady.length && paginatedReady.length > 0}
                        onChange={handleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                    {canViewColumn(userRole, 'ready', 'ready_no') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready_no')}>Ready No</th>}
                    {canViewColumn(userRole, 'ready', 'tanggal_input') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('tanggal_input')}>Tanggal</th>}
                    {canViewColumn(userRole, 'ready', 'branch') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('branch_name')}>Cabang</th>}
                    {canViewColumn(userRole, 'ready', 'category') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sub_category')}>Sub Category</th>}
                    {canViewColumn(userRole, 'ready', 'product_name') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>Product</th>}
                    <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('id_product')}>Product ID</th>
                    {canViewColumn(userRole, 'ready', 'quantity') && <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ready')}>Ready</th>}
                    <th className="border px-2 py-1 text-left font-medium cursor-pointer hover:bg-gray-200" onClick={() => handleSort('waste')}>Waste</th>
                    {(userRole === 'admin' || userRole === 'manager') && <th className="border px-2 py-1 text-left font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: itemsPerPage }).map((_, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {Array.from({ length: 10 }).map((_, cellIdx) => (
                          <td key={cellIdx} className="border px-2 py-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginatedReady.length === 0 ? (
                    <tr>
                      <td colSpan={Object.keys(['ready_no', 'tanggal_input', 'branch', 'category', 'product_name', 'id_product', 'quantity', 'waste', 'actions']).filter(col => 
                        col === 'actions' ? (userRole === 'admin' || userRole === 'manager') : 
                        col === 'id_product' || col === 'waste' ? true :
                        canViewColumn(userRole, 'ready', col)
                      ).length} className="text-center py-2 text-gray-500 text-xs">
                        {userRole === 'staff' && !canViewColumn(userRole, 'ready', 'product_name') ? 
                         'You have limited access to ready stock data' : 
                         'No ready stock records found'}
                      </td>
                    </tr>
                  ) : (
                    paginatedReady.map((item, idx) => (
                      <tr key={item.id_ready} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id_ready)}
                            onChange={() => handleItemSelect(item.id_ready)}
                            className="cursor-pointer"
                          />
                        </td>
                        {canViewColumn(userRole, 'ready', 'ready_no') && <td className="border px-2 py-1">{item.ready_no}</td>}
                        {canViewColumn(userRole, 'ready', 'tanggal_input') && <td className="border px-2 py-1">{item.tanggal_input}</td>}
                        {canViewColumn(userRole, 'ready', 'branch') && <td className="border px-2 py-1">{item.branch_name}</td>}
                        {canViewColumn(userRole, 'ready', 'category') && <td className="border px-2 py-1">{item.sub_category}</td>}
                        {canViewColumn(userRole, 'ready', 'product_name') && <td className="border px-2 py-1">{item.product_name}</td>}
                        <td className="border px-2 py-1 text-center">{item.id_product}</td>
                        {canViewColumn(userRole, 'ready', 'quantity') && <td className="border px-2 py-1 text-right">{item.ready}</td>}
                        <td className="border px-2 py-1 text-right">{item.waste}</td>
                        {(userRole === 'admin' || userRole === 'manager') && (
                          <td className="border px-2 py-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            >
                              <Edit size={12} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <p className="text-xs text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedReady.length)} of {filteredAndSortedReady.length} entries
              </p>
              <div className="flex gap-1">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  First
                </button>
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Prev
                </button>
                <span className="px-2 py-0.5 border rounded text-xs">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0} 
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Next
                </button>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0} 
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-2 py-0.5 border rounded disabled:opacity-50 text-xs"
                >
                  Last
                </button>
              </div>
            </div>
          </>
        )}

        {/* Summary when table is hidden */}
        {!showDataTable && (
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Ready Stock Management</h3>
            <p className="text-gray-600 mb-4">Total Records: {ready.length}</p>
            <p className="text-sm text-gray-500">Click "Show Data Table" to view and manage your ready stock data</p>
          </div>
        )}


      </div>
    </Layout>
  );
}