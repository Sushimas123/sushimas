-- Create finance_dashboard_view
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
        THEN EXTRACT(DAY FROM CURRENT_DATE - (po.po_date + INTERVAL '1 day' * po.termin_days))::integer
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