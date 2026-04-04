'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, RefreshCw, Layers, ClipboardList, CheckCircle2, ArrowRight, Building2, PackagePlus } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import NewOrderModal from '@/components/NewOrderModal'

const shortId = (id: string) => `#${id.slice(-4).toUpperCase()}`

export default function Dashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      let activeUser = user

      if (authError || !user) {
        // Double check session to ensure it's not a race condition
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }
        activeUser = session.user
      }

      if (!activeUser) {
        router.push('/login')
        return
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('owner_id', activeUser.id)
        .single()

      if (tenantError || !tenant) {
        console.error('Error fetching tenant:', tenantError)
        setLoading(false)
        return
      }

      setActiveTenantId(tenant.id)
      setBusinessName(tenant.name)
    }

    init()
  }, [router])

  const fetchData = async () => {
    if (!activeTenantId) return
    setLoading(true)
    try {
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*, tenants(name)')
        .eq('status', 'pending')
        .eq('tenant_id', activeTenantId)

      const { data: activeBatches, error: batchesError } = await supabase
        .from('batches')
        .select('*, tenants(name)')
        .eq('status', 'active')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: true })

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
    if (activeTenantId) {
      fetchData()
    }
  }, [activeTenantId])

  const generateBatches = async () => {
    if (!activeTenantId) return
    setGenerating(true)
    try {
      const response = await fetch('/api/batches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: activeTenantId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate batches')
      }

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
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {businessName || 'Dashboard'}
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Logistics operations overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="add-order-btn"
              onClick={() => setShowOrderModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all border border-zinc-700 active:scale-95"
            >
              <PackagePlus className="w-5 h-5 text-amber-400" />
              Add Order
            </button>
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
                      <th className="px-6 py-4 font-semibold">Order</th>
                      <th className="px-6 py-4 font-semibold">Sender → Receiver</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic">
                          No pending orders — click &ldquo;Add Order&rdquo; to create one.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Order {shortId(order.id)}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{order.tenants?.name || businessName}</p>
                          </td>
                          <td className="px-6 py-4">
                            {order.sender_name ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  <span className="text-amber-500">↑</span> {order.sender_name}
                                  {order.sender_phone && <span className="font-normal text-zinc-400"> · {order.sender_phone}</span>}
                                </span>
                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  <span className="text-indigo-400">↓</span> {order.receiver_name}
                                  {order.receiver_phone && <span className="font-normal text-zinc-400"> · {order.receiver_phone}</span>}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
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
                      <th className="px-6 py-4 font-semibold">Batch</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
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
                      batches.map((batch, idx) => (
                        <tr key={batch.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Run #{idx + 1}</p>
                            <p className="text-xs font-mono text-zinc-400 mt-0.5">{shortId(batch.id)}</p>
                          </td>
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

      {/* New Order Modal */}
      {showOrderModal && (
        <NewOrderModal
          onClose={() => setShowOrderModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}
