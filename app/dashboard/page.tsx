'use client'

import { useEffect, useState } from 'react'
import { PlusCircle, RefreshCw, Layers, ClipboardList, CheckCircle2, ArrowRight } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

// Hardcoded tenant_id for testing purposes
const TEST_TENANT_ID = 'be0d85ef-54cd-4b34-8c25-8bc4780604d8'

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch pending orders
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .eq('tenant_id', TEST_TENANT_ID)

      // Fetch active batches
      const { data: activeBatches, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .eq('status', 'active')
        .eq('tenant_id', TEST_TENANT_ID)

      if (ordersError) console.error('Error fetching orders:', ordersError)
      if (batchesError) console.error('Error fetching batches:', batchesError)

      setOrders(pendingOrders || [])
      setBatches(activeBatches || [])
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const generateBatches = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/batches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TEST_TENANT_ID }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate batches')
      }

      // Refresh data after generation
      await fetchData()
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Managing logistics for Tenant ID: <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{TEST_TENANT_ID}</span></p>
          </div>
          <button
            onClick={generateBatches}
            disabled={generating}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {generating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <PlusCircle className="w-5 h-5" />
            )}
            {generating ? 'Generating...' : 'Generate Optimal Batches'}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Pending Orders</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{loading ? '...' : orders.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Active Batches</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{loading ? '...' : batches.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Orders Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              Pending Orders
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ID</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 italic">
                          No pending orders found.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">{order.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium">
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Active Batches Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <Layers className="w-5 h-5 text-emerald-500" />
              Active Batches
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ID</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Created At</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {batches.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic">
                          No active batches found.
                        </td>
                      </tr>
                    ) : (
                      batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">{batch.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full font-medium flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              {batch.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <a
                              href={`/rider/${batch.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-xs font-bold text-white hover:bg-zinc-800 transition-all active:scale-95"
                            >
                              Rider View
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
