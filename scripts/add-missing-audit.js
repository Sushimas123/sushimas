#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pages yang belum ada audit trail
const missingAuditPages = [
  // Finance pages
  'finance/purchase-orders',
  'finance/bulk-payments', 
  'finance/aging-report',
  'finance/aging-pivot',
  
  // Purchase order pages
  'purchaseorder',
  'purchaseorder/create',
  'purchaseorder/edit', 
  'purchaseorder/barang_masuk',
  'purchaseorder/stock-alert',
  
  // User management
  'users',
  'branches',
  'permissions-db',
  'crud-permissions',
  
  // Other pages
  'transfer-barang',
  'analysis',
  'esb',
  'pivot',
  'price-history'
];

const auditImport = `import { insertWithAudit, updateWithAudit, deleteWithAudit, logAuditTrail } from '@/src/utils/auditTrail';`;

function addAuditTrailToPage(pagePath) {
  const filePath = path.join(__dirname, '..', 'app', pagePath, 'page.tsx');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File tidak ditemukan: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip jika sudah ada audit trail
  if (content.includes('insertWithAudit') || content.includes('auditTrail')) {
    console.log(`✅ ${pagePath} - Sudah ada audit trail`);
    return;
  }
  
  // Add import after existing imports
  if (!content.includes(auditImport)) {
    // Find the last import statement
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, nextLineIndex + 1) + auditImport + '\n' + content.slice(nextLineIndex + 1);
    }
  }
  
  // Replace common supabase operations with audit versions
  
  // INSERT operations
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.insert\(\[?([^)]+)\]?\)/g,
    'await insertWithAudit(\'$1\', $2)'
  );
  
  // UPDATE operations
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.update\(([^)]+)\)\s*\.eq\(['"`](\w+)['"`],\s*([^)]+)\)/g,
    'await updateWithAudit(\'$1\', $2, {\'$3\': $4})'
  );
  
  // Soft DELETE operations (is_active = false)
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.update\(\s*\{\s*is_active:\s*false[^}]*\}\s*\)\s*\.eq\(['"`](\w+)['"`],\s*([^)]+)\)/g,
    'await deleteWithAudit(\'$1\', {\'$2\': $3})'
  );
  
  // Add audit logging for export operations
  if (content.includes('XLSX.writeFile') || content.includes('export')) {
    const exportRegex = /XLSX\.writeFile\([^)]+\)/g;
    content = content.replace(exportRegex, (match) => {
      return `${match};\n      await logAuditTrail({ table_name: 'export', record_id: 0, action: 'EXPORT' })`;
    });
  }
  
  // Write back
  fs.writeFileSync(filePath, content);
  console.log(`✅ ${pagePath} - Audit trail ditambahkan`);
}

console.log('🚀 Menambahkan audit trail ke halaman yang belum ada...\n');

missingAuditPages.forEach(addAuditTrailToPage);

console.log('\n✅ Selesai! Cek manual untuk memastikan tidak ada error syntax.');
console.log('📝 Pastikan tabel audit_log sudah ada di database');
console.log('🔧 Jalankan: node scripts/add-missing-audit.js');