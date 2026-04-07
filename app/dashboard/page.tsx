'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, RefreshCw, Layers, ClipboardList, CheckCircle2, ArrowRight, Building2, PackagePlus, DollarSign, Activity, Route, Box, Bell, Search, User, LogOut, X } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import NewOrderModal from '@/components/NewOrderModal'

const shortId = (id: string) => `#${id.slice(-5).toUpperCase()}`

export default function Dashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      let activeUser = user

      if (authError || !user) {
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

      setUserEmail(activeUser.email || null)
      setActiveTenantId(tenant.id)
      setBusinessName(tenant.name)
    }

    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 relative overflow-hidden font-sans selection:bg-radium-green/30">
      {/* Background cinematic glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-radium-green/20 blur-[150px] mix-blend-multiply rounded-full animate-float"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-zinc-300/50 blur-[150px] mix-blend-multiply rounded-full animate-float-slow"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.5)_0%,rgba(250,250,250,1)_100%)]"></div>
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 flex h-screen overflow-hidden">



        {/* Central Content Space */}
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">

          {/* Top Bar Navigation */}
          <div className="flex flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-zinc-500 text-sm mt-1 font-medium">{businessName || 'Logistics operations overview'}</p>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center overflow-hidden hover:border-radium-green transition-colors"
              >
                <User className="w-5 h-5 text-zinc-600" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md border border-zinc-100 shadow-xl rounded-xl p-2 flex flex-col z-50">
                  <div className="px-3 py-2 border-b border-zinc-100 mb-2 relative">
                    <button
                      onClick={() => setShowProfileMenu(false)}
                      className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-xs font-bold text-zinc-900 truncate pr-4">{businessName || 'Business'}</p>
                    <p className="text-[10px] text-zinc-500 truncate pr-4">{userEmail || 'user@example.com'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-left px-3 py-2 text-xs font-semibold text-red-500 hover:bg-zinc-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Log out
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-3.5 py-3.5 bg-zinc-900 border border-transparent hover:bg-zinc-800 text-white rounded-[16px] text-sm font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4 text-radium-green" />
              Add Order
            </button>
            <button
              onClick={generateBatches}
              disabled={generating}
              className="px-3.5 py-3.5 bg-radium-green hover:bg-radium-green-hover disabled:opacity-50 text-zinc-950 rounded-[16px] text-sm font-bold transition-all shadow-lg flex items-center gap-2"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Compute Routes'}
            </button>
          </div>

          {/* Top Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Card 1: Total Orders */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-radium-green/10 blur-[50px] rounded-full group-hover:bg-radium-green/20 transition-all"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-zinc-500 text-sm font-bold">Total Pending Orders</h3>
                <span className="text-[10px] font-bold text-zinc-950 bg-radium-green/20 px-2 py-1 rounded-md border border-radium-green/30">+5.2%</span>
              </div>
              <div className="text-4xl font-bold mb-2 text-zinc-900">{loading ? '--' : orders.length}</div>
              <div className="w-full h-10 mt-4 flex items-end gap-1 opacity-60">
                {/* Mini mock chart */}
                {[4, 7, 3, 8, 5, 9, 6, 10].map((h, i) => (
                  <div key={i} className="flex-1 bg-zinc-900/10 rounded-t-sm transition-all group-hover:bg-radium-green" style={{ height: `${h * 10}%` }}></div>
                ))}
              </div>
            </div>

            {/* Card 2: Active Deliveries */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200/50 blur-[50px] rounded-full transition-all"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-zinc-500 text-sm font-bold">Active Deliveries</h3>
                <span className="text-[10px] font-bold text-zinc-950 bg-radium-green/20 px-2 py-1 rounded-md border border-radium-green/30">+10.1%</span>
              </div>
              {/* Compute total orders in batches */}
              <div className="text-4xl font-bold mb-2 text-zinc-900">{loading ? '--' : batches.length * 4}</div>

              <div className="relative w-full h-12 mt-2">
                <svg className="absolute w-full h-full opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10 L100,30 L0,30 Z" fill="url(#gradient)" />
                  <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10" fill="none" stroke="#d4ff00" strokeWidth="1.5" />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(212, 255, 0, 0.2)" />
                      <stop offset="100%" stopColor="rgba(212, 255, 0, 0)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Card 3: Active Batches */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200/50 blur-[50px] rounded-full transition-all"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-zinc-500 text-sm font-bold">Active Batches</h3>
              </div>
              <div className="text-4xl font-bold mb-3 text-zinc-900">{loading ? '--' : batches.length}</div>

              <div className="w-full bg-zinc-100 shadow-inner rounded-full h-1.5 mt-8 overflow-hidden">
                <div className="bg-radium-green h-full w-[60%] glow-radium rounded-full"></div>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 mt-2 text-right">In Progress</p>
            </div>
          </div>

          {/* Data Tables Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">

            {/* Pending Orders Table */}
            <div className="glass-card flex flex-col overflow-hidden w-full p-4 mb-4">
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center mb-2">
                <h2 className="text-base font-bold text-zinc-900 tracking-wide flex items-center gap-2">
                  Pending Orders
                </h2>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-zinc-50 rounded-lg text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center rounded-tl-lg">Status</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center">Customer</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center">Destination</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center rounded-tr-lg">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">No pending orders found.</td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] uppercase font-bold rounded-md">
                              Pending
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {order.sender_name || 'N/A'}
                          </td>
                          <td className="px-5 py-4 text-zinc-500 text-xs truncate max-w-[120px] text-center">
                            {order.receiver_name}
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-400 text-center">
                            {shortId(order.id)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Batches Table */}
            <div className="glass-card flex flex-col overflow-hidden w-full p-4 mb-4">
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center mb-2">
                <h2 className="text-base font-bold tracking-wide text-zinc-900 flex items-center gap-2">
                  Active Batches
                </h2>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-zinc-50 rounded-lg text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center rounded-tl-lg">View</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center">ID</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center">Rider</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center">Date</th>
                      <th className="px-5 py-4 border-b border-zinc-100 text-center rounded-tr-lg">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                    {batches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">No active batches.</td>
                      </tr>
                    ) : (
                      batches.map((batch, idx) => (
                        <tr key={batch.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-5 py-4 text-center">
                            <a
                              href={`/rider/${batch.id}`}
                              target="_self"
                              rel="noreferrer"
                              className="text-[10px] px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold inline-block flex-nowrap whitespace-nowrap shadow-md"
                            >
                              Track
                            </a>
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-500 text-center">
                            {shortId(batch.id)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-zinc-400" />
                              </div>
                              <span className="text-xs text-nowrap font-bold">Rider {idx + 1}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-zinc-500 text-xs text-center font-bold">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 flex justify-center">
                            <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden shadow-inner mt-2">
                              <div className="h-full bg-radium-green w-1/2 rounded-full"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>

      {showOrderModal && (
        <NewOrderModal
          onClose={() => setShowOrderModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

function MoreHorizontal(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
}

function ArrowLeft(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
}
