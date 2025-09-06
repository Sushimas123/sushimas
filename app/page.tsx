"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from "../components/Layout"
import { Package, Users, Building2, Settings, TrendingUp, AlertTriangle, CheckCircle, Clock, BarChart3, Eye, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user')
    if (userData) {
      // If logged in, redirect to dashboard
      router.push('/dashboard')
    } else {
      // If not logged in, redirect to login
      router.push('/login')
    }
  }, [])
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}
