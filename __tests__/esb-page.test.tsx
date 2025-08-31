import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ESBPage from '../app/esb/page'

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        ilike: jest.fn(() => ({
          range: jest.fn(() => Promise.resolve({
            data: [
              { id: 1, sales_date: '2023-01-01', branch: 'Jakarta', product: 'Product A', sub_category: 'Cat A' }
            ],
            error: null,
            count: 1
          }))
        }))
      })),
      ilike: jest.fn(() => ({
        range: jest.fn(() => Promise.resolve({
          data: [],
          error: null,
          count: 0
        }))
      })),
      range: jest.fn(() => Promise.resolve({
        data: [
          { id: 1, sales_date: '2023-01-01', branch: 'Jakarta', product: 'Product A', sub_category: 'Cat A' }
        ],
        error: null,
        count: 1
      }))
    }))
  }))
}

jest.mock('@/src/lib/supabaseClient', () => ({
  supabase: mockSupabase
}))

describe('ESBPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders page title', () => {
    render(<ESBPage />)
    expect(screen.getByText('Laporan ESB Harian')).toBeInTheDocument()
  })

  test('renders filter inputs', () => {
    render(<ESBPage />)
    expect(screen.getByPlaceholderText('Cabang')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Produk')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sub Category')).toBeInTheDocument()
  })

  test('handles filter input changes', () => {
    render(<ESBPage />)
    const cabangInput = screen.getByPlaceholderText('Cabang')
    
    fireEvent.change(cabangInput, { target: { value: 'Jakarta' } })
    expect(cabangInput).toHaveValue('Jakarta')
  })

  test('calls fetchData on filter button click', async () => {
    render(<ESBPage />)
    const filterButton = screen.getByText('Filter')
    
    fireEvent.click(filterButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('esb_harian')
    })
  })

  test('resets filters on reset button click', async () => {
    render(<ESBPage />)
    const cabangInput = screen.getByPlaceholderText('Cabang')
    const resetButton = screen.getByText('Reset')
    
    fireEvent.change(cabangInput, { target: { value: 'Jakarta' } })
    fireEvent.click(resetButton)
    
    expect(cabangInput).toHaveValue('')
  })

  test('displays loading state', async () => {
    render(<ESBPage />)
    expect(screen.getByText('Memuat data...')).toBeInTheDocument()
  })

  test('handles pagination', async () => {
    render(<ESBPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Menampilkan 1 dari 1 hasil')).toBeInTheDocument()
    })
  })
})