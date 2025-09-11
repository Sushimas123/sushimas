"use client"

import React from 'react'
import Layout from '../../components/Layout'
import PageAccessControl from '../../components/PageAccessControl'

function DashboardContent() {
  return (
    <div className="p-6">
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard</h1>
        <p className="text-gray-600">Welcome to the dashboard</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Layout>
      <PageAccessControl pageName="dashboard">
        <DashboardContent />
      </PageAccessControl>
    </Layout>
  )
}