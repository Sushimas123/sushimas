"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { CheckCircle, X, MessageSquare, Clock, AlertTriangle } from 'lucide-react'
import Layout from '../../../components/Layout'
import PageAccessControl from '../../../components/PageAccessControl'

interface PendingApproval {
  id: number
  po_ids: number[]
  supplier_id: number
  scheduled_date: string
  total_amount: number
  payment_method: string
  status: string
  notes: string
  created_at: string
  suppliers: {
    nama_supplier: string
    nama_penerima: string
    bank_penerima: string
    nomor_rekening: string
  }
  users: {
    nama_lengkap: string
    email: string
  }
  existing_approvals: any[]
}

export default function PaymentApprovals() {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<PendingApproval | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | 'returned'>('approved')
  const [comments, setComments] = useState('')

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      const { data: payments, error } = await supabase
        .from('payment_schedules')
        .select(`
          *,
          suppliers(nama_supplier, nama_penerima, bank_penerima, nomor_rekening),
          users(nama_lengkap, email)
        `)
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        setPendingApprovals([])
        return
      }

      if (!payments) {
        setPendingApprovals([])
        return
      }

      const paymentsWithApprovals = await Promise.all(
        payments.map(async (payment) => {
          const { data: approvals } = await supabase
            .from('payment_approvals')
            .select(`
              *,
              users(nama_lengkap, email)
            `)
            .eq('payment_schedule_id', payment.id)

          return {
            ...payment,
            existing_approvals: approvals || []
          }
        })
      )

      setPendingApprovals(paymentsWithApprovals)
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      setPendingApprovals([])
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async () => {
    if (!selectedPayment) return

    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null

      const { error: approvalError } = await supabase
        .from('payment_approvals')
        .insert({
          payment_schedule_id: selectedPayment.id,
          approver_id: user?.id_user,
          action: approvalAction,
          comments: comments
        })

      if (approvalError) throw approvalError

      if (approvalAction === 'approved') {
        const { error: updateError } = await supabase
          .from('payment_schedules')
          .update({ 
            status: 'approved',
            approved_by: user?.id_user,
            approved_at: new Date().toISOString()
          })
          .eq('id', selectedPayment.id)

        if (updateError) throw updateError
      } else if (approvalAction === 'rejected') {
        const { error: rejectError } = await supabase
          .from('payment_schedules')
          .update({ status: 'cancelled' })
          .eq('id', selectedPayment.id)

        if (rejectError) throw rejectError
      }

      await fetchPendingApprovals()
      setShowApprovalModal(false)
      setSelectedPayment(null)
      setComments('')
    } catch (error) {
      console.error('Error processing approval:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getUrgencyColor = (amount: number, date: string) => {
    const scheduledDate = new Date(date)
    const today = new Date()
    const daysUntil = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntil < 0) return 'border-red-500 bg-red-50'
    if (daysUntil <= 1) return 'border-orange-500 bg-orange-50'
    if (amount > 10000000) return 'border-purple-500 bg-purple-50'
    return 'border-gray-200 bg-white'
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageAccessControl pageName="finance">
        <div className="p-6">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Approvals</h1>
              <p className="text-gray-600">Review and approve scheduled payments</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/payment-schedules/init', { method: 'POST' })
                  if (response.ok) {
                    await fetchPendingApprovals()
                  }
                } catch (error) {
                  console.error('Error initializing:', error)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Initialize Sample Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold">{pendingApprovals.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">High Amount (&gt;10M)</p>
                  <p className="text-2xl font-bold">
                    {pendingApprovals.filter(p => p.total_amount > 10000000).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(pendingApprovals.reduce((sum, p) => sum + p.total_amount, 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {pendingApprovals.map(payment => (
              <div key={payment.id} className={`rounded-lg border-2 p-6 ${getUrgencyColor(payment.total_amount, payment.scheduled_date)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{payment.suppliers.nama_supplier}</h3>
                      {payment.total_amount > 10000000 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                          HIGH AMOUNT
                        </span>
                      )}
                      {new Date(payment.scheduled_date) <= new Date() && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          URGENT
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(payment.total_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Scheduled Date</p>
                        <p className="text-lg font-medium text-gray-900">
                          {new Date(payment.scheduled_date).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Bank Account</p>
                        <p className="text-sm text-gray-900">{payment.suppliers.bank_penerima}</p>
                        <p className="text-sm text-gray-500">{payment.suppliers.nomor_rekening}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Requested by</p>
                        <p className="text-sm text-gray-900">{payment.users?.nama_lengkap || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{new Date(payment.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>

                    {payment.notes && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600">Notes</p>
                        <p className="text-sm text-gray-900">{payment.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedPayment(payment)
                        setApprovalAction('approved')
                        setShowApprovalModal(true)
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPayment(payment)
                        setApprovalAction('rejected')
                        setShowApprovalModal(true)
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                    >
                      <X size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pendingApprovals.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
              <p className="text-gray-600">All payments have been processed.</p>
            </div>
          )}

          {showApprovalModal && selectedPayment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">
                  {approvalAction === 'approved' ? 'Approve Payment' : 'Reject Payment'}
                </h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Supplier</p>
                  <p className="font-medium">{selectedPayment.suppliers.nama_supplier}</p>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-medium">{formatCurrency(selectedPayment.total_amount)}</p>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments {approvalAction === 'rejected' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder={
                      approvalAction === 'approved' ? 'Optional comments...' : 'Please provide reason for rejection...'
                    }
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleApproval}
                    disabled={approvalAction === 'rejected' && !comments.trim()}
                    className={`flex-1 py-2 rounded-md text-white font-medium disabled:opacity-50 ${
                      approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {approvalAction === 'approved' ? 'Approve' : 'Reject'}
                  </button>
                  <button
                    onClick={() => {
                      setShowApprovalModal(false)
                      setSelectedPayment(null)
                      setComments('')
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageAccessControl>
    </Layout>
  )
}