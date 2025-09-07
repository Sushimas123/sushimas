// Google Apps Script untuk mengambil data dari Supabase
// File: Code.gs

// Konfigurasi Supabase
const SUPABASE_URL = 'https://rnxvzlkqjbpjqvgvqvqv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueHZ6bGtxamJwanF2Z3ZxdnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NDI4NzQsImV4cCI6MjA1MDUxODg3NH0.VJJhJGJhcOCJhJGJhcOCJhJGJhcOCJhJGJhcOC' // Ganti dengan anon key yang benar

function testSupabaseConnection() {
  try {
    // Test connection dengan mengambil 1 record dari esb_harian
    const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/esb_harian?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = JSON.parse(response.getContentText())
    console.log('Connection successful:', data)
    return data
  } catch (error) {
    console.error('Connection failed:', error.toString())
    return null
  }
}

function getESBData(startDate = null, endDate = null, branch = null) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/esb_harian?select=*`
    
    // Add filters
    const filters = []
    if (startDate) filters.push(`sales_date=gte.${startDate}`)
    if (endDate) filters.push(`sales_date=lte.${endDate}`)
    if (branch) filters.push(`branch=eq.${branch}`)
    
    if (filters.length > 0) {
      url += '&' + filters.join('&')
    }
    
    // Add ordering
    url += '&order=sales_date.desc'
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`)
    }
    
    const data = JSON.parse(response.getContentText())
    console.log(`Retrieved ${data.length} records`)
    return data
    
  } catch (error) {
    console.error('Error fetching ESB data:', error.toString())
    return []
  }
}

function writeESBToSheet() {
  try {
    // Get data from Supabase
    const data = getESBData()
    
    if (data.length === 0) {
      console.log('No data retrieved')
      return
    }
    
    // Get or create sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    let sheet = spreadsheet.getSheetByName('ESB Data')
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet('ESB Data')
    }
    
    // Clear existing data
    sheet.clear()
    
    // Get column headers from first record
    const headers = Object.keys(data[0])
    
    // Write headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    
    // Write data
    const rows = data.map(record => headers.map(header => record[header] || ''))
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows)
    
    // Format headers
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0f0f0')
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length)
    
    console.log(`Successfully wrote ${data.length} records to sheet`)
    
  } catch (error) {
    console.error('Error writing to sheet:', error.toString())
  }
}

function insertESBData(salesDate, branch, product, productCode, category, subCategory, unit, qtyTotal, valueTotal) {
  try {
    const payload = {
      sales_date: salesDate,
      branch: branch,
      product: product,
      product_code: productCode,
      category: category,
      sub_category: subCategory,
      unit: unit,
      qty_total: qtyTotal,
      value_total: valueTotal
    }
    
    const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/esb_harian`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      payload: JSON.stringify(payload)
    })
    
    if (response.getResponseCode() === 201) {
      const result = JSON.parse(response.getContentText())
      console.log('Data inserted successfully:', result)
      return result
    } else {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`)
    }
    
  } catch (error) {
    console.error('Error inserting data:', error.toString())
    return null
  }
}

// Function untuk setup trigger otomatis
function createTriggers() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'writeESBToSheet') {
      ScriptApp.deleteTrigger(trigger)
    }
  })
  
  // Create new trigger - run every hour
  ScriptApp.newTrigger('writeESBToSheet')
    .timeBased()
    .everyHours(1)
    .create()
    
  console.log('Trigger created successfully')
}

// Function untuk test manual
function runTest() {
  console.log('Testing Supabase connection...')
  testSupabaseConnection()
  
  console.log('Getting ESB data...')
  writeESBToSheet()
}