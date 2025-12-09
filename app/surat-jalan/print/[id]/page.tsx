'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useParams } from 'next/navigation'

interface SuratJalan {
  id_surat_jalan: number
  no_surat_jalan: string
  tanggal: string
  cabang_tujuan_id: number
  driver: string
  dibuat_oleh: string
  disetujui_oleh: string
  diterima_oleh?: string
  notes?: string
  branches?: { nama_branch: string }
}

interface SuratJalanItem {
  no_urut: number
  id_product: number
  jumlah_barang: number
  satuan: string
  keterangan: string
  nama_product?: { product_name: string }
}

export default function PrintSuratJalan() {
  const params = useParams()
  const [suratJalan, setSuratJalan] = useState<SuratJalan | null>(null)
  const [items, setItems] = useState<SuratJalanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params?.id) {
      fetchSuratJalan(params.id as string)
    }
  }, [params?.id])

  useEffect(() => {
    if (suratJalan) {
      // Auto print when data is loaded
      setTimeout(() => {
        window.print()
      }, 1000)
    }
  }, [suratJalan])

  const fetchSuratJalan = async (id: string) => {
    try {
      const [suratJalanData, itemsData] = await Promise.all([
        supabase
          .from('surat_jalan')
          .select(`
            *,
            branches(nama_branch)
          `)
          .eq('id_surat_jalan', id)
          .single(),
        supabase
          .from('surat_jalan_items')
          .select(`
            *,
            nama_product(product_name)
          `)
          .eq('id_surat_jalan', id)
          .order('no_urut')
      ])

      if (suratJalanData.data) setSuratJalan(suratJalanData.data)
      if (itemsData.data) setItems(itemsData.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!suratJalan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Surat Jalan Tidak Ditemukan</h1>
          <button onClick={() => window.close()} className="px-4 py-2 bg-gray-600 text-white rounded">
            Tutup
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
        }
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #2c5aa0;
          padding-bottom: 15px;
        }
        .header h1 {
          font-size: 28px;
          color: #2c5aa0;
          margin-bottom: 10px;
        }
        .header h2 {
          font-size: 18px;
          color: #333;
          font-weight: normal;
        }
        .info-table {
          width: 100%;
          margin-bottom: 25px;
          border-collapse: collapse;
        }
        .info-table td {
          padding: 10px;
          border: 1px solid #dee2e6;
        }
        .info-table td:first-child {
          background-color: #2c5aa0;
          color: white;
          font-weight: bold;
          width: 25%;
        }
        .items-title {
          background: #2c5aa0;
          color: white;
          padding: 12px;
          margin: 20px 0 10px 0;
          font-size: 16px;
          font-weight: bold;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #2c5aa0;
        }
        .items-table th {
          background-color: #e9ecef;
          padding: 12px;
          border: 1px solid #2c5aa0;
          text-align: center;
          font-weight: bold;
        }
        .items-table td {
          padding: 10px;
          border: 1px solid #dee2e6;
          vertical-align: top;
        }
        .items-table tbody tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        .items-table td:nth-child(1) { text-align: center; width: 8%; }
        .items-table td:nth-child(2) { width: 42%; }
        .items-table td:nth-child(3) { text-align: center; width: 15%; }
        .items-table td:nth-child(4) { text-align: center; width: 15%; }
        .items-table td:nth-child(5) { width: 20%; }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 60px;
        }
        .signature {
          text-align: center;
          flex: 1;
        }
        .signature-label {
          font-weight: bold;
          margin-bottom: 16px;
        }
        .signature-space {
          height: 40px;
          margin-bottom: 8px;
        }
        .signature-name {
          border-top: 2px solid #2c5aa0;
          padding-top: 8px;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #6c757d;
          border-top: 1px solid #dee2e6;
          padding-top: 10px;
        }
      `}</style>

      <div className="header">
        <h1>SURAT JALAN</h1>
        <h2>No: {suratJalan.no_surat_jalan}</h2>
      </div>

      <table className="info-table">
        <tbody>
          <tr>
            <td>Tanggal</td>
            <td>{new Date(suratJalan.tanggal).toLocaleDateString('id-ID')}</td>
          </tr>
          <tr>
            <td>Cabang Tujuan</td>
            <td>{suratJalan.branches?.nama_branch || '-'}</td>
          </tr>
          <tr>
            <td>Driver</td>
            <td>{suratJalan.driver}</td>
          </tr>
          {suratJalan.notes && (
            <tr>
              <td>Notes</td>
              <td>{suratJalan.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="items-title">DAFTAR BARANG</div>
      <table className="items-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang</th>
            <th>Jumlah</th>
            <th>Satuan</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{(item.nama_product as any)?.product_name || '-'}</td>
              <td>{item.jumlah_barang}</td>
              <td>{item.satuan}</td>
              <td>{item.keterangan || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        margin: '25px 0',
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <p style={{
          fontWeight: 'bold',
          fontSize: '14px',
          color: '#856404',
          margin: 0
        }}>
          JANGAN LUPA! SEMUA INVOICE, BON, DAN FAKTUR PAJAK DARI SUPPLIER, DIKIRIM KE DEPOK
        </p>
      </div>

      <div className="signatures">
        <div className="signature">
          <div className="signature-label">Diterima Oleh</div>
          <div className="signature-space"></div>
          <div className="signature-name">{suratJalan.diterima_oleh || '(_________________)'}</div>
        </div>
        <div className="signature">
          <div className="signature-label">Dibuat Oleh</div>
          <div className="signature-space">
            {suratJalan.dibuat_oleh?.toLowerCase() === 'andi' && (
              <img 
                src="/signatures/andi.png" 
                alt="Signature" 
                style={{
                  width: '250px',
                  height: '40px',
                  objectFit: 'contain',
                  margin: '0 auto',
                  display: 'block'
                }}
              />
            )}
          </div>
          <div className="signature-name">{suratJalan.dibuat_oleh}</div>
        </div>
        <div className="signature">
          <div className="signature-label">Disetujui Oleh</div>
          <div className="signature-space">
            {suratJalan.disetujui_oleh?.toLowerCase() === 'andi' && (
              <img 
                src="/signatures/andi.png" 
                alt="Signature" 
                style={{
                  width: '250px',
                  height: '40px',
                  objectFit: 'contain',
                  margin: '0 auto',
                  display: 'block'
                }}
              />
            )}
          </div>
          <div className="signature-name">{suratJalan.disetujui_oleh}</div>
        </div>
      </div>

      <div className="footer">
        Dokumen ini dicetak secara elektronik pada {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID')}
      </div>

      <div className="no-print" style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={() => window.print()} 
          style={{
            padding: '12px 24px',
            background: '#2c5aa0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            marginRight: '10px'
          }}
        >
          Print PDF
        </button>
        <button 
          onClick={() => window.close()} 
          style={{
            padding: '12px 24px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Close
        </button>
      </div>
    </>
  )
}