import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/src/lib/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    const { expenseId }: { expenseId: number } = await req.json()
    console.log('Converting expense ID:', expenseId)

    // Get expense data
    const { data: expense, error: expenseError } = await supabase
      .from('petty_cash_expenses')
      .select('*')
      .eq('id', expenseId)
      .is('barang_masuk_id', null)
      .single()

    console.log('Expense query result:', { expense, expenseError })

    if (expenseError || !expense) {
      console.log('Expense not found or error:', expenseError)
      return NextResponse.json({ error: 'Expense not found or already converted' }, { status: 404 })
    }

    if (!expense.product_id || !expense.qty) {
      return NextResponse.json({ error: 'Product and quantity required' }, { status: 400 })
    }

    // Get request data to find branch_code
    const { data: requestData, error: requestError } = await supabase
      .from('petty_cash_requests')
      .select('branch_code')
      .eq('id', expense.request_id)
      .single()

    console.log('Request query result:', { requestData, requestError })

    if (requestError || !requestData) {
      console.log('Request not found or error:', requestError)
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Get branch_id from branch_code
    const { data: branchData, error: branchError } = await supabase
      .from('branches')
      .select('id_branch')
      .eq('kode_branch', requestData.branch_code)
      .single()

    console.log('Branch query result:', { branchData, branchError })

    if (branchError || !branchData) {
      console.log('Branch not found or error:', branchError)
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Create barang masuk entry
    const barangMasukData = {
      tanggal: expense.expense_date,
      id_barang: expense.product_id,
      jumlah: expense.qty,
      harga: expense.harga || (expense.amount / expense.qty),
      id_branch: branchData.id_branch,
      keterangan: `Converted from Petty Cash: ${expense.description}`,
      no_po: `PETTY-CASH-${expense.id}`,
      invoice_number: expense.receipt_number || null,
      id_supplier: null,
      qty_po: expense.qty,
      created_by: expense.created_by
    }
    
    console.log('Creating barang masuk with data:', barangMasukData)
    
    const { data: barangMasuk, error: barangMasukError } = await supabase
      .from('barang_masuk')
      .insert(barangMasukData)
      .select()
      .single()

    console.log('Barang masuk creation result:', { barangMasuk, barangMasukError })

    if (barangMasukError) {
      console.log('Failed to create barang masuk:', barangMasukError)
      return NextResponse.json({ error: 'Failed to create barang masuk', details: barangMasukError }, { status: 500 })
    }

    // Update expense with barang_masuk_id
    const { error: updateError } = await supabase
      .from('petty_cash_expenses')
      .update({ barang_masuk_id: barangMasuk.id })
      .eq('id', expenseId)

    console.log('Update expense result:', { updateError })

    if (updateError) {
      console.log('Failed to update expense:', updateError)
      return NextResponse.json({ error: 'Failed to update expense', details: updateError }, { status: 500 })
    }

    return NextResponse.json({ success: true, barangMasukId: barangMasuk.id })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}