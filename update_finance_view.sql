-- Create function to calculate due date with payment terms
CREATE OR REPLACE FUNCTION get_po_due_date(
    po_date DATE,
    delivery_date DATE,
    payment_term_id INTEGER,
    fallback_termin_days INTEGER
) RETURNS TIMESTAMP AS $$
DECLARE
    payment_term RECORD;
    base_date DATE;
    due_date DATE;
    current_day INTEGER;
    target_day INTEGER;
    days_to_add INTEGER;
    payment_date INTEGER;
    target_date DATE;
    next_payment_date DATE;
BEGIN
    -- If no payment term, use fallback termin_days
    IF payment_term_id IS NULL THEN
        IF delivery_date IS NOT NULL THEN
            RETURN (delivery_date + INTERVAL '1 day' * fallback_termin_days)::TIMESTAMP;
        ELSE
            RETURN NULL;
        END IF;
    END IF;
    
    -- Get payment term details
    SELECT * INTO payment_term 
    FROM payment_terms 
    WHERE id_payment_term = payment_term_id;
    
    IF NOT FOUND THEN
        -- Fallback to termin_days if payment term not found
        IF delivery_date IS NOT NULL THEN
            RETURN (delivery_date + INTERVAL '1 day' * fallback_termin_days)::TIMESTAMP;
        ELSE
            RETURN NULL;
        END IF;
    END IF;
    
    CASE payment_term.calculation_type
        WHEN 'from_invoice' THEN
            base_date := po_date;
            due_date := base_date + INTERVAL '1 day' * payment_term.days;
            RETURN due_date::TIMESTAMP;
            
        WHEN 'from_delivery' THEN
            IF delivery_date IS NULL THEN
                RETURN NULL;
            END IF;
            base_date := delivery_date;
            due_date := base_date + INTERVAL '1 day' * payment_term.days;
            RETURN due_date::TIMESTAMP;
            
        WHEN 'fixed_dates' THEN
            base_date := po_date;
            next_payment_date := NULL;
            
            FOR payment_date IN SELECT unnest(payment_term.payment_dates)
            LOOP
                IF payment_date = 999 THEN
                    target_date := (DATE_TRUNC('month', base_date) + INTERVAL '1 month - 1 day')::DATE;
                ELSE
                    target_date := (DATE_TRUNC('month', base_date) + INTERVAL '1 day' * (payment_date - 1))::DATE;
                END IF;
                
                IF target_date <= base_date THEN
                    IF payment_date = 999 THEN
                        target_date := (DATE_TRUNC('month', base_date) + INTERVAL '2 month - 1 day')::DATE;
                    ELSE
                        target_date := (DATE_TRUNC('month', base_date) + INTERVAL '1 month')::DATE + INTERVAL '1 day' * (payment_date - 1);
                    END IF;
                END IF;
                
                IF next_payment_date IS NULL OR target_date < next_payment_date THEN
                    next_payment_date := target_date;
                END IF;
            END LOOP;
            
            RETURN next_payment_date::TIMESTAMP;
            
        WHEN 'weekly' THEN
            base_date := po_date;
            current_day := EXTRACT(DOW FROM base_date);
            target_day := payment_term.payment_day_of_week;
            
            days_to_add := target_day - current_day;
            IF days_to_add <= 0 THEN
                days_to_add := days_to_add + 7;
            END IF;
            
            due_date := base_date + INTERVAL '1 day' * days_to_add;
            RETURN due_date::TIMESTAMP;
            
        ELSE
            -- Default: treat as from_invoice
            base_date := po_date;
            due_date := base_date + INTERVAL '1 day' * payment_term.days;
            RETURN due_date::TIMESTAMP;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update the finance_dashboard_view to use payment terms
CREATE OR REPLACE VIEW finance_dashboard_view AS
SELECT po.id,
    po.po_number,
    po.po_date,
    po.cabang_id,
    b.nama_branch,
    b.badan,
    po.supplier_id,
    s.nama_supplier,
    s.nomor_rekening,
    s.bank_penerima,
    s.nama_penerima,
    po.termin_days,
    -- Use payment terms calculation with fallback to termin_days
    get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days) AS tanggal_jatuh_tempo,
    po.status AS po_status,
    po.priority,
    po.invoice_number,
    po.bukti_foto,
    po.tanggal_barang_sampai,
    po.notes,
    po.bulk_payment_ref,
    COALESCE(sum(
        CASE
            WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
            WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric)) THEN (pi.qty * pi.actual_price)
            ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
        END), (0)::numeric) AS total_po,
    COALESCE(po.total_tagih, sum(
        CASE
            WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
            ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
        END), (0)::numeric) AS total_tagih,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN COALESCE(po.total_tagih, sum(
            CASE
                WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
                ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
            END), (0)::numeric)
            ELSE COALESCE(sum(pp.payment_amount), (0)::numeric)
        END AS total_paid,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN (0)::numeric
            ELSE (COALESCE(po.total_tagih, sum(
            CASE
                WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
                ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
            END), (0)::numeric) - COALESCE(sum(pp.payment_amount), (0)::numeric))
        END AS sisa_bayar,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN 'paid'::text
            WHEN (COALESCE(sum(pp.payment_amount), (0)::numeric) = (0)::numeric) THEN 'unpaid'::text
            WHEN (COALESCE(sum(pp.payment_amount), (0)::numeric) >= COALESCE(po.total_tagih, sum(
            CASE
                WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
                ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
            END), (0)::numeric)) THEN 'paid'::text
            ELSE 'partial'::text
        END AS status_payment,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN false
            WHEN (get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days) IS NOT NULL 
                  AND get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days) < CURRENT_DATE 
                  AND (COALESCE(sum(pp.payment_amount), (0)::numeric) < COALESCE(po.total_tagih, sum(
            CASE
                WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
                ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
            END), (0)::numeric))) THEN true
            ELSE false
        END AS is_overdue,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN 0
            WHEN (get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days) IS NOT NULL 
                  AND get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days) < CURRENT_DATE 
                  AND (COALESCE(sum(pp.payment_amount), (0)::numeric) < COALESCE(po.total_tagih, sum(
            CASE
                WHEN ((pi.actual_price IS NOT NULL) AND (pi.actual_price > (0)::numeric) AND (pi.received_qty IS NOT NULL)) THEN ((pi.received_qty)::numeric * pi.actual_price)
                ELSE (pi.qty * COALESCE(np.harga, pi.harga, (0)::numeric))
            END), (0)::numeric))) THEN (EXTRACT(day FROM ((CURRENT_DATE)::timestamp without time zone - get_po_due_date(po.po_date, po.tanggal_barang_sampai, po.id_payment_term, po.termin_days))))::integer
            ELSE 0
        END AS days_overdue,
    po.created_at,
        CASE
            WHEN (po.bulk_payment_ref IS NOT NULL) THEN bp.payment_date
            ELSE max(pp.payment_date)
        END AS last_payment_date
   FROM ((((((purchase_orders po
     LEFT JOIN po_items pi ON ((po.id = pi.po_id)))
     LEFT JOIN nama_product np ON ((pi.product_id = np.id_product)))
     LEFT JOIN po_payments pp ON (((po.id = pp.po_id) AND ((pp.status)::text = 'completed'::text))))
     LEFT JOIN suppliers s ON ((po.supplier_id = s.id_supplier)))
     LEFT JOIN branches b ON ((po.cabang_id = b.id_branch)))
     LEFT JOIN bulk_payments bp ON ((po.bulk_payment_ref = bp.bulk_reference)))
  GROUP BY po.id, po.po_number, po.po_date, po.cabang_id, b.nama_branch, b.badan, po.supplier_id, s.nama_supplier, s.nomor_rekening, s.bank_penerima, s.nama_penerima, po.termin_days, po.status, po.priority, po.invoice_number, po.bukti_foto, po.tanggal_barang_sampai, po.notes, po.bulk_payment_ref, po.created_at, bp.payment_date, po.total_tagih, po.id_payment_term
  ORDER BY po.po_date DESC;