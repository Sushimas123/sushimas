# Role-Based Access Control System

## Overview
Sistem ini telah diperbarui dengan role-based access control (RBAC) yang mengatur akses pengguna berdasarkan peran mereka.

## Roles Available
1. **Admin** - Akses penuh ke semua fitur dan data
2. **Manager** - Akses ke sebagian besar fitur, terbatas pada beberapa kolom sensitif
3. **PIC Branch** - Akses terbatas untuk operasional cabang
4. **Staff** - Akses paling terbatas, hanya untuk tugas dasar

## Features Implemented

### 1. Authentication & Authorization
- **Login System**: Mengambil data user dari database dan menyimpan role
- **Middleware Protection**: Route protection berdasarkan role
- **Session Management**: Menggunakan localStorage dan cookie

### 2. Role-Based Navigation
- **Dynamic Menu**: Menu yang tampil disesuaikan dengan role user
- **Access Control**: Halaman yang tidak bisa diakses akan redirect ke dashboard

### 3. Column-Level Permissions
- **ESB Report**: 
  - Admin/Manager: Semua kolom
  - PIC Branch: Tanpa value_total
  - Staff: Tanpa price dan value_total
  
- **Users Management**:
  - Admin: Semua kolom + CRUD operations
  - Manager: View only, tanpa password dan actions
  - PIC Branch: Info dasar saja
  - Staff: Tidak bisa akses

- **Ready Stock**:
  - Admin/Manager: Semua kolom + CRUD
  - PIC Branch: Operasional data
  - Staff: View terbatas

### 4. UI Indicators
- **Role Badge**: Menampilkan role user di header
- **Access Level**: Indikator level akses di setiap halaman
- **Restricted Columns**: Kolom yang tidak bisa diakses ditandai dengan 🔒

## File Structure

### Core Files
- `/middleware.ts` - Route protection
- `/src/utils/auth.ts` - Role definitions dan permissions
- `/src/utils/columnPermissions.ts` - Column-level access control

### Updated Pages
- `/app/login/page.tsx` - Enhanced login with role fetching
- `/app/dashboard/page.tsx` - Role-based dashboard
- `/app/esb/page.tsx` - Column permissions implemented
- `/app/users/page.tsx` - Full RBAC implementation
- `/app/ready/page.tsx` - Column permissions implemented
- `/components/Layout.tsx` - Role-based navigation

## Usage Examples

### Checking Page Access
```typescript
// In middleware.ts
const requiredRoles = ROUTE_PERMISSIONS[pathname]
if (!requiredRoles.includes(userRole)) {
  // Redirect to dashboard
}
```

### Checking Column Access
```typescript
// In components
import { canViewColumn } from '@/src/utils/columnPermissions'

{canViewColumn(userRole, 'esb', 'value_total') && (
  <th>Value Total</th>
)}
```

### Role-Based Menu
```typescript
// In Layout.tsx
const filteredMenuItems = menuItems.filter(item => 
  item.roles.includes(userRole)
)
```

## Security Features

1. **Route Protection**: Middleware mencegah akses tidak sah
2. **Column Hiding**: Data sensitif disembunyikan berdasarkan role
3. **Action Restrictions**: CRUD operations dibatasi berdasarkan role
4. **Session Validation**: Cookie dan localStorage validation

## Testing Different Roles

1. Login dengan user yang memiliki role berbeda
2. Navigasi akan otomatis disesuaikan
3. Kolom tabel akan disembunyikan/ditampilkan sesuai permission
4. Actions (edit, delete, add) akan dibatasi sesuai role

## Future Enhancements

1. **Granular Permissions**: Permission per field/action
2. **Role Hierarchy**: Inheritance system untuk roles
3. **Audit Logging**: Track user actions berdasarkan role
4. **Dynamic Roles**: Admin dapat mengatur role permissions
5. **Branch-Level Access**: Pembatasan data berdasarkan cabang user

## Notes

- Sistem ini menggunakan localStorage untuk client-side dan cookie untuk middleware
- Column permissions dapat dengan mudah dikonfigurasi di `columnPermissions.ts`
- Route permissions dapat diatur di `middleware.ts`
- Semua komponen sudah responsive dan mobile-friendly