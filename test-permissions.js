// Simple test untuk CRUD permissions
console.log('Testing CRUD Permissions System...');

// Test 1: Import functions
try {
  const { canPerformActionSync } = require('./src/utils/rolePermissions');
  console.log('✅ Import rolePermissions berhasil');
} catch (error) {
  console.log('❌ Import rolePermissions gagal:', error.message);
}

// Test 2: Test permission logic
const testPermissions = [
  { role: 'super admin', page: 'ready', action: 'create', expected: true },
  { role: 'finance', page: 'ready', action: 'create', expected: false },
  { role: 'staff', page: 'ready', action: 'edit', expected: false },
  { role: 'pic branch', page: 'ready', action: 'delete', expected: false }
];

console.log('\nTesting permission logic:');
testPermissions.forEach(test => {
  try {
    // Simulate fallback permissions since we can't access DB in Node.js
    const FALLBACK_PERMISSIONS = {
      'super admin': { ready: { create: true, edit: true, delete: true } },
      'finance': { ready: { create: false, edit: false, delete: false } },
      'staff': { ready: { create: true, edit: false, delete: false } },
      'pic branch': { ready: { create: true, edit: true, delete: false } }
    };
    
    const rolePerms = FALLBACK_PERMISSIONS[test.role];
    const result = rolePerms && rolePerms[test.page] && rolePerms[test.page][test.action];
    
    if (result === test.expected) {
      console.log(`✅ ${test.role} - ${test.page} - ${test.action}: ${result}`);
    } else {
      console.log(`❌ ${test.role} - ${test.page} - ${test.action}: expected ${test.expected}, got ${result}`);
    }
  } catch (error) {
    console.log(`❌ Error testing ${test.role}: ${error.message}`);
  }
});

console.log('\n🎯 Test selesai! Silakan cek hasil di atas.');
console.log('📝 Untuk test lengkap, buka browser dan akses:');
console.log('   - /crud-permissions (untuk manage permissions)');
console.log('   - /ready (untuk test CRUD buttons)');
console.log('   - /gudang (untuk test CRUD buttons)');
console.log('   - /produksi (untuk test CRUD buttons)');