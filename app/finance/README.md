# Finance Module

Module finance untuk mengelola pembayaran dan tracking Purchase Orders.

## Struktur Folder

```
finance/
├── purchase-orders/          # Halaman utama finance PO
│   ├── page.tsx             # Dashboard finance PO
│   └── PaymentModal.tsx     # Modal untuk manage payment
├── aging-report/            # Laporan aging
│   └── page.tsx            # Halaman aging report
├── sql/                     # SQL setup files
│   └── finance_setup.sql   # Setup tabel dan view
└── README.md               # Dokumentasi ini
```

## Setup Database

Jalankan SQL berikut untuk setup database:

```sql
-- 1. Buat tabel po_payments
CREATE TABLE IF NOT EXISTS public.po_payments (
    id serial PRIMARY KEY,
    po_id integer NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    payment_date date NOT NULL,
    payment_amount numeric(15,2) NOT NULL,
    payment_method varchar(50),
    payment_via varchar(100),
    reference_number varchar(100),
    notes text,
    status varchar(50) DEFAULT 'completed',
    created_at timestamp DEFAULT now(),
    created_by integer REFERENCES users(id_user)
);

-- 2. Buat view finance_dashboard_view
-- (Lihat file sql/finance_setup.sql untuk detail lengkap)
```

## Fitur

### 1. Finance Dashboard (`/finance/purchase-orders`)
- **Summary Cards**: Total PO, Sudah Dibayar, Outstanding, Overdue
- **Filter & Search**: By status payment, supplier, PO number
- **Payment Management**: Add, view, delete payments
- **Status Tracking**: Unpaid, Partial, Paid, Overdue

### 2. Payment Modal
- **Add Payment**: Input pembayaran baru dengan validasi
- **Payment History**: Riwayat semua pembayaran per PO
- **Multiple Payments**: Support pembayaran bertahap
- **Payment Methods**: Transfer, Cash, Check, Credit

### 3. Aging Report (`/finance/aging-report`)
- **Aging Buckets**: Current, 1-30, 31-60, 61-90, >90 hari
- **Summary by Age**: Total outstanding per bucket
- **Detail Report**: List semua PO dengan aging info
- **Overdue Tracking**: Highlight PO yang terlambat

## Data Flow

1. **PO Creation**: Data dari `purchase_orders` dan `po_items`
2. **Payment Entry**: Input ke `po_payments` table
3. **Auto Calculation**: View `finance_dashboard_view` menghitung:
   - Total PO dari `po_items.total`
   - Total paid dari `po_payments.payment_amount`
   - Status payment berdasarkan perbandingan
   - Overdue berdasarkan `po_date + termin_days`

## Status Payment

- **unpaid**: Belum ada pembayaran
- **partial**: Sudah bayar sebagian
- **paid**: Lunas (total_paid >= total_po)
- **overdue**: Terlambat bayar (melewati jatuh tempo)

## Payment Methods

- **transfer**: Transfer bank
- **cash**: Tunai
- **check**: Cek
- **credit**: Kredit

## Access Control

Role yang bisa akses finance module:
- `super admin`
- `admin` 
- `finance`

## API Endpoints (Supabase)

### Tables
- `po_payments`: CRUD operations untuk payment
- `finance_dashboard_view`: Read-only view untuk dashboard

### Key Queries
```sql
-- Get finance dashboard data
SELECT * FROM finance_dashboard_view ORDER BY po_date DESC;

-- Get payments for specific PO
SELECT * FROM po_payments WHERE po_id = ? ORDER BY payment_date DESC;

-- Add new payment
INSERT INTO po_payments (po_id, payment_date, payment_amount, ...) VALUES (...);
```

## Validasi

### Payment Validation
- Payment amount > 0
- Payment amount <= remaining balance
- Required fields: date, amount, method

### Business Rules
- Tidak bisa bayar melebihi total PO
- Status otomatis update berdasarkan total payment
- Overdue detection otomatis berdasarkan jatuh tempo

## Future Enhancements

1. **Export Report**: Excel/PDF export
2. **Payment Approval**: Workflow approval untuk payment
3. **Bank Integration**: Auto import bank statement
4. **Email Notifications**: Alert untuk overdue payments
5. **Payment Scheduling**: Schedule future payments
6. **Multi-currency**: Support multiple currencies