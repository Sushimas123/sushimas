-- Finance Setup SQL
-- Tabel dan View untuk Finance Management

-- 1. Tabel untuk tracking pembayaran PO
CREATE TABLE IF NOT EXISTS public.po_payments (
    id serial PRIMARY KEY,
    po_id integer NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    payment_date date NOT NULL,
    payment_amount numeric(15,2) NOT NULL,
    payment_method varchar(50), -- 'transfer', 'cash', 'check', 'credit'
    payment_via varchar(100), -- 'BCA', 'Mandiri', 'Cash', etc
    reference_number varchar(100), -- No transfer/check
    notes text,
    status varchar(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    created_at timestamp DEFAULT now(),
    created_by integer REFERENCES users(id_user)
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_po_payments_po_id ON public.po_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_date ON public.po_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_po_payments_status ON public.po_payments(status);

-- 2. View untuk Finance Dashboard
CREATE OR REPLACE VIEW finance_dashboard_view AS
SELECT 
    po.id,
    po.po_number,
    po.po_date,
    po.cabang_id,
    b.nama_branch,
    po.supplier_id,
    s.nama_supplier,
    s.nomor_rekening,
    s.bank_penerima,
    s.nama_penerima,
    po.termin_days,
    po.po_date + INTERVAL '1 day' * po.termin_days as tanggal_jatuh_tempo,
    po.status as po_status,
    po.priority,
    po.invoice_number,
    po.bukti_foto,
    po.tanggal_barang_sampai,
    
    -- Total PO
    COALESCE(SUM(pi.total), 0) as total_po,
    
    -- Payment info
    COALESCE(SUM(pp.payment_amount), 0) as total_paid,
    COALESCE(SUM(pi.total), 0) - COALESCE(SUM(pp.payment_amount), 0) as sisa_bayar,
    
    -- Payment status
    CASE 
        WHEN COALESCE(SUM(pp.payment_amount), 0) = 0 THEN 'unpaid'
        WHEN COALESCE(SUM(pp.payment_amount), 0) >= COALESCE(SUM(pi.total), 0) THEN 'paid'
        ELSE 'partial'
    END as status_payment,
    
    -- Overdue check
    CASE 
        WHEN po.po_date + INTERVAL '1 day' * po.termin_days < CURRENT_DATE 
        AND COALESCE(SUM(pp.payment_amount), 0) < COALESCE(SUM(pi.total), 0) 
        THEN true 
        ELSE false 
    END as is_overdue,
    
    -- Days overdue
    CASE 
        WHEN po.po_date + INTERVAL '1 day' * po.termin_days < CURRENT_DATE 
        THEN CURRENT_DATE - (po.po_date + INTERVAL '1 day' * po.termin_days)
        ELSE 0
    END as days_overdue,
    
    po.created_at,
    MAX(pp.payment_date) as last_payment_date

FROM purchase_orders po
LEFT JOIN po_items pi ON po.id = pi.po_id
LEFT JOIN po_payments pp ON po.id = pp.po_id AND pp.status = 'completed'
LEFT JOIN suppliers s ON po.supplier_id = s.id_supplier
LEFT JOIN branches b ON po.cabang_id = b.id_branch
GROUP BY 
    po.id, po.po_number, po.po_date, po.cabang_id, b.nama_branch,
    po.supplier_id, s.nama_supplier, s.nomor_rekening, s.bank_penerima, 
    s.nama_penerima, po.termin_days, po.status, po.priority, 
    po.invoice_number, po.bukti_foto, po.tanggal_barang_sampai, po.created_at
ORDER BY po.po_date DESC;

-- 3. Trigger untuk update updated_at pada po_payments
CREATE OR REPLACE FUNCTION update_po_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tambah kolom updated_at jika belum ada
ALTER TABLE po_payments ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Create trigger
DROP TRIGGER IF EXISTS update_po_payments_updated_at ON po_payments;
CREATE TRIGGER update_po_payments_updated_at
    BEFORE UPDATE ON po_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_po_payments_updated_at();