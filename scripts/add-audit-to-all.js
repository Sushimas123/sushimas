#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pages yang perlu audit trail
const pages = [
  'ready', 'gudang', 'produksi', 'produksi_detail', 
  'categories', 'recipes', 'supplier', 'product_name', 
  'product_settings', 'stock_opname'
];

const auditImport = `import { insertWithAudit, updateWithAudit, deleteWithAudit } from '@/src/utils/auditTrail';`;

function addAuditTrailToPage(pageName) {
  const filePath = path.join(__dirname, '..', 'app', pageName, 'page.tsx');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File tidak ditemukan: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip jika sudah ada audit trail
  if (content.includes('insertWithAudit')) {
    console.log(`✅ ${pageName} - Sudah ada audit trail`);
    return;
  }
  
  // Add import
  if (!content.includes(auditImport)) {
    const importRegex = /import.*from.*rolePermissions.*;\n/;
    if (importRegex.test(content)) {
      content = content.replace(importRegex, match => match + auditImport + '\n');
    } else {
      // Add after last import
      const lastImportIndex = content.lastIndexOf("import");
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, nextLineIndex + 1) + auditImport + '\n' + content.slice(nextLineIndex + 1);
    }
  }
  
  // Replace direct supabase operations
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.insert\(\[([^\]]+)\]\)/g,
    'await insertWithAudit(\'$1\', $2)'
  );
  
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.update\(([^)]+)\)\s*\.eq\((['"`]\w+['"`]),\s*([^)]+)\)/g,
    'await updateWithAudit(\'$1\', $2, {$3: $4})'
  );
  
  content = content.replace(
    /await supabase\s*\.from\(['"`](\w+)['"`]\)\s*\.update\(\s*\{\s*is_active:\s*false[^}]*\}\s*\)\s*\.eq\((['"`]\w+['"`]),\s*([^)]+)\)/g,
    'await deleteWithAudit(\'$1\', {$2: $3})'
  );
  
  // Write back
  fs.writeFileSync(filePath, content);
  console.log(`✅ ${pageName} - Audit trail ditambahkan`);
}

console.log('🚀 Menambahkan audit trail ke semua pages...\n');

pages.forEach(addAuditTrailToPage);

console.log('\n✅ Selesai! Cek manual untuk memastikan tidak ada error syntax.');
console.log('📝 Jangan lupa jalankan SQL script: /sql/add_audit_trail.sql');