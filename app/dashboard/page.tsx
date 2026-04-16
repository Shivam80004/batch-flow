'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlusCircle, RefreshCw, ArrowRight, PackagePlus, Activity,
  Route, Box, User, LogOut, X, Truck, Layers, ChevronRight,
  Radio, IndianRupee, CheckCircle2, Zap, MapPin
} from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import NewOrderModal from '@/components/NewOrderModal'

const shortId = (id: string) => `#${id.slice(-5).toUpperCase()}`

type Tab = 'overview' | 'dispatch'

// ── Toaster ──────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[slideUp_0.4s_ease-out]">
      <div className="flex items-center gap-3 bg-zinc-900 border border-radium-green/30 text-white px-5 py-3.5 rounded-2xl shadow-2xl">
        <CheckCircle2 className="w-4 h-4 text-radium-green shrink-0" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  // Auth
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Overview data
  const [orders, setOrders] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)

  // Dispatch data
  const [unassignedBatches, setUnassignedBatches] = useState<any[]>([])
  const [onlineRiders, setOnlineRiders] = useState<any[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Payout rate setting
  const [payoutRate, setPayoutRate] = useState<number>(8)
  const [savingRate, setSavingRate] = useState(false)

  // ── Init auth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      let activeUser = user

      if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        activeUser = session.user
      }

      if (!activeUser) { router.push('/login'); return }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, payout_rate')
        .eq('owner_id', activeUser.id)
        .single()

      if (!tenant) { setLoading(false); return }

      setUserEmail(activeUser.email || null)
      setActiveTenantId(tenant.id)
      setBusinessName(tenant.name)
      setPayoutRate(tenant.payout_rate ?? 8)
    }
    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Overview data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!activeTenantId) return
    setLoading(true)
    try {
      const [{ data: pendingOrders }, { data: activeBatches }] = await Promise.all([
        supabase.from('orders').select('*, tenants(name)').eq('status', 'pending').eq('tenant_id', activeTenantId),
        supabase.from('batches').select('*, tenants(name)').eq('status', 'active').eq('tenant_id', activeTenantId).order('created_at', { ascending: true }),
      ])
      setOrders(pendingOrders || [])
      setBatches(activeBatches || [])
    } finally {
      setLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    if (activeTenantId) fetchData()
  }, [activeTenantId, fetchData])

  // ── Dispatch data ─────────────────────────────────────────────────────────
  const fetchDispatchData = useCallback(async () => {
    if (!activeTenantId) return
    setDispatchLoading(true)
    try {
      const [{ data: uBatches }, { data: riders }] = await Promise.all([
        supabase
          .from('batches')
          .select('id, created_at, status')
          .eq('status', 'unassigned')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, is_online, last_location')
          .eq('is_online', true),
      ])
      setUnassignedBatches(uBatches || [])
      setOnlineRiders(riders || [])
    } finally {
      setDispatchLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    if (activeTab === 'dispatch' && activeTenantId) fetchDispatchData()
  }, [activeTab, activeTenantId, fetchDispatchData])

  // ── Dispatch a batch ──────────────────────────────────────────────────────
  const dispatchBatch = async (riderId: string) => {
    if (!selectedBatchId) { setToast('Select a batch first'); return }
    setDispatching(true)
    const { error } = await supabase
      .from('batches')
      .update({ rider_id: riderId, status: 'assigned' })
      .eq('id', selectedBatchId)

    if (error) {
      alert('Dispatch failed: ' + error.message)
    } else {
      setToast(`Batch dispatched to rider successfully!`)
      setSelectedBatchId(null)
      await fetchDispatchData()
    }
    setDispatching(false)
  }

  // ── Save payout rate ──────────────────────────────────────────────────────
  const savePayoutRate = async () => {
    if (!activeTenantId) return
    setSavingRate(true)
    const { error } = await supabase
      .from('tenants')
      .update({ payout_rate: payoutRate })
      .eq('id', activeTenantId)
    if (!error) setToast(`Payout rate updated to ₹${payoutRate}/km`)
    setSavingRate(false)
  }

  // ── Generate batches ──────────────────────────────────────────────────────
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
        const err = await response.json()
        throw new Error(err.error || 'Failed to generate batches')
      }
      await fetchData()
      if (activeTab === 'dispatch') await fetchDispatchData()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 relative overflow-hidden font-sans selection:bg-radium-green/30">
      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) translateX(-50%); }
          to   { opacity: 1; transform: translateY(0)   translateX(-50%); }
        }
      `}</style>

      {/* Background glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-radium-green/20 blur-[150px] mix-blend-multiply rounded-full animate-float" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-zinc-300/50 blur-[150px] mix-blend-multiply rounded-full animate-float-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.5)_0%,rgba(250,250,250,1)_100%)]" />
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="relative z-10 flex h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">

          {/* Top Bar */}
          <div className="flex flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-zinc-500 text-sm mt-1 font-medium">{businessName || 'Logistics operations overview'}</p>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center hover:border-radium-green transition-colors"
              >
                <User className="w-5 h-5 text-zinc-600" />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md border border-zinc-100 shadow-xl rounded-xl p-2 flex flex-col z-50">
                  <div className="px-3 py-2 border-b border-zinc-100 mb-2 relative">
                    <button onClick={() => setShowProfileMenu(false)} className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-xs font-bold text-zinc-900 truncate pr-4">{businessName || 'Business'}</p>
                    <p className="text-[10px] text-zinc-500 truncate pr-4">{userEmail || ''}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-left px-3 py-2 text-xs font-semibold text-red-500 hover:bg-zinc-50 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-3.5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-[16px] text-sm font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4 text-radium-green" /> Add Order
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

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-[18px] w-fit mb-8 border border-zinc-200/60">
            {(['overview', 'dispatch'] as Tab[]).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white text-zinc-900 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {tab === 'dispatch' && (
                  <span className="relative flex h-2 w-2">
                    {onlineRiders.length > 0 && activeTab !== 'dispatch' && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-radium-green opacity-75 animate-ping" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${onlineRiders.length > 0 ? 'bg-radium-green' : 'bg-zinc-300'}`} />
                  </span>
                )}
                {tab === 'overview' ? 'Overview' : 'Dispatch'}
                {tab === 'dispatch' && onlineRiders.length > 0 && (
                  <span className="text-[10px] font-black bg-radium-green text-zinc-950 px-1.5 py-0.5 rounded-md">
                    {onlineRiders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="glass-card p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-radium-green/10 blur-[50px] rounded-full group-hover:bg-radium-green/20 transition-all" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-zinc-500 text-sm font-bold">Pending Orders</h3>
                    <span className="text-[10px] font-bold text-zinc-950 bg-radium-green/20 px-2 py-1 rounded-md border border-radium-green/30">+5.2%</span>
                  </div>
                  <div className="text-4xl font-bold mb-2 text-zinc-900">{loading ? '--' : orders.length}</div>
                  <div className="w-full h-10 mt-4 flex items-end gap-1 opacity-60">
                    {[4, 7, 3, 8, 5, 9, 6, 10].map((h, i) => (
                      <div key={i} className="flex-1 bg-zinc-900/10 rounded-t-sm group-hover:bg-radium-green transition-all" style={{ height: `${h * 10}%` }} />
                    ))}
                  </div>
                </div>

                <div className="glass-card p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200/50 blur-[50px] rounded-full" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-zinc-500 text-sm font-bold">Active Deliveries</h3>
                    <span className="text-[10px] font-bold text-zinc-950 bg-radium-green/20 px-2 py-1 rounded-md border border-radium-green/30">+10.1%</span>
                  </div>
                  <div className="text-4xl font-bold mb-2 text-zinc-900">{loading ? '--' : batches.length * 4}</div>
                  <div className="relative w-full h-12 mt-2">
                    <svg className="absolute w-full h-full opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10 L100,30 L0,30 Z" fill="url(#grad2)" />
                      <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10" fill="none" stroke="#d4ff00" strokeWidth="1.5" />
                      <defs>
                        <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(212,255,0,0.2)" />
                          <stop offset="100%" stopColor="rgba(212,255,0,0)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                <div className="glass-card p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200/50 blur-[50px] rounded-full" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-zinc-500 text-sm font-bold">Active Batches</h3>
                  </div>
                  <div className="text-4xl font-bold mb-3 text-zinc-900">{loading ? '--' : batches.length}</div>
                  <div className="w-full bg-zinc-100 shadow-inner rounded-full h-1.5 mt-8 overflow-hidden">
                    <div className="bg-radium-green h-full w-[60%] glow-radium rounded-full" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 mt-2 text-right">In Progress</p>
                </div>
              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">
                {/* Pending Orders */}
                <div className="glass-card flex flex-col overflow-hidden w-full p-4 mb-4">
                  <div className="p-4 border-b border-zinc-100 mb-2">
                    <h2 className="text-base font-bold text-zinc-900 tracking-wide">Pending Orders</h2>
                  </div>
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-zinc-50 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Status</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Customer</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Destination</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                        {orders.length === 0 ? (
                          <tr><td colSpan={4} className="px-5 py-12 text-center text-zinc-500">No pending orders found.</td></tr>
                        ) : (
                          orders.map((order) => (
                            <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex items-center px-2 py-1 bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] uppercase font-bold rounded-md">Pending</span>
                              </td>
                              <td className="px-5 py-4 text-center">{order.sender_name || 'N/A'}</td>
                              <td className="px-5 py-4 text-zinc-500 text-xs truncate max-w-[120px] text-center">{order.receiver_name}</td>
                              <td className="px-5 py-4 font-mono text-[11px] text-zinc-400 text-center">{shortId(order.id)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Batches */}
                <div className="glass-card flex flex-col overflow-hidden w-full p-4 mb-4">
                  <div className="p-4 border-b border-zinc-100 mb-2">
                    <h2 className="text-base font-bold text-zinc-900 tracking-wide">Active Batches</h2>
                  </div>
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-zinc-50 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">View</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">ID</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Rider</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Date</th>
                          <th className="px-5 py-4 border-b border-zinc-100 text-center">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                        {batches.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-500">No active batches.</td></tr>
                        ) : (
                          batches.map((batch, idx) => (
                            <tr key={batch.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-5 py-4 text-center">
                                <a href={`/rider/${batch.id}`} className="text-[10px] px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold inline-block shadow-md">Track</a>
                              </td>
                              <td className="px-5 py-4 font-mono text-[11px] text-zinc-500 text-center">{shortId(batch.id)}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                                    <User className="w-4 h-4 text-zinc-400" />
                                  </div>
                                  <span className="text-xs font-bold">Rider {idx + 1}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-zinc-500 text-xs text-center font-bold">{new Date(batch.created_at).toLocaleDateString()}</td>
                              <td className="px-5 py-4 flex justify-center">
                                <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden shadow-inner mt-2">
                                  <div className="h-full bg-radium-green w-1/2 rounded-full" />
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
            </>
          )}

          {/* ── DISPATCH TAB ─────────────────────────────────────────────── */}
          {activeTab === 'dispatch' && (
            <div className="pb-10">

              {/* Payout Rate Setting */}
              <div className="glass-card p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-radium-green/10 border border-radium-green/20 flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 text-radium-green" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Payout Rate</p>
                    <p className="text-[10px] text-zinc-500">Riders earn this per km delivered</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-zinc-500 text-sm">₹</span>
                  <input
                    id="payout-rate-input"
                    type="number"
                    min={1}
                    max={999}
                    step={0.5}
                    value={payoutRate}
                    onChange={(e) => setPayoutRate(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 font-bold text-center text-sm focus:outline-none focus:border-radium-green focus:ring-1 focus:ring-radium-green/50 transition-all"
                  />
                  <span className="text-zinc-500 text-sm font-medium">/ km</span>
                  <button
                    id="save-payout-rate-btn"
                    onClick={savePayoutRate}
                    disabled={savingRate}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {savingRate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-radium-green" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Instruction banner */}
              {!selectedBatchId && (
                <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl mb-6 text-sm text-amber-700 font-medium">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Select a batch from the left, then click a rider on the right to dispatch.</span>
                </div>
              )}
              {selectedBatchId && (
                <div className="flex items-center gap-3 px-5 py-3.5 bg-radium-green/10 border border-radium-green/30 rounded-2xl mb-6 text-sm text-zinc-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-radium-green shrink-0" />
                  <span>Batch <strong>{shortId(selectedBatchId)}</strong> selected — now click a rider to dispatch!</span>
                  <button onClick={() => setSelectedBatchId(null)} className="ml-auto text-zinc-400 hover:text-zinc-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Two-column dispatch layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* LEFT: Unassigned Batches */}
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-500" />
                      <h2 className="text-sm font-bold text-zinc-900">Unassigned Batches</h2>
                      <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">
                        {unassignedBatches.length}
                      </span>
                    </div>
                    <button
                      onClick={fetchDispatchData}
                      disabled={dispatchLoading}
                      className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${dispatchLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="p-3 flex flex-col gap-2 max-h-[480px] overflow-y-auto">
                    {dispatchLoading ? (
                      <div className="py-10 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
                      </div>
                    ) : unassignedBatches.length === 0 ? (
                      <div className="py-10 text-center text-zinc-400 text-sm">
                        <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        No unassigned batches.<br />
                        <span className="text-xs">Run "Compute Routes" to generate batches.</span>
                      </div>
                    ) : (
                      unassignedBatches.map((batch) => {
                        const isSelected = selectedBatchId === batch.id
                        return (
                          <button
                            key={batch.id}
                            id={`batch-card-${batch.id.slice(-4)}`}
                            onClick={() => setSelectedBatchId(isSelected ? null : batch.id)}
                            className={`w-full text-left px-4 py-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                              isSelected
                                ? 'bg-radium-green/10 border-radium-green/40'
                                : 'bg-zinc-50 border-zinc-200 hover:bg-white hover:border-zinc-300 hover:shadow-sm'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-radium-green/20' : 'bg-zinc-100'
                            }`}>
                              <Box className={`w-5 h-5 ${isSelected ? 'text-radium-green' : 'text-zinc-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-sm text-zinc-900">{shortId(batch.id)}</span>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">Unassigned</span>
                              </div>
                              <p className="text-[11px] text-zinc-400 font-medium">
                                Created {new Date(batch.created_at).toLocaleString()}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-radium-green shrink-0" />
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: Online Riders */}
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-radium-green animate-pulse" />
                      <h2 className="text-sm font-bold text-zinc-900">Available Riders</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        onlineRiders.length > 0
                          ? 'bg-radium-green/15 text-green-800 border border-radium-green/30'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {onlineRiders.length} online
                      </span>
                    </div>
                    <button
                      onClick={fetchDispatchData}
                      className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>

                  <div className="p-3 flex flex-col gap-2 max-h-[480px] overflow-y-auto">
                    {onlineRiders.length === 0 ? (
                      <div className="py-10 text-center text-zinc-400 text-sm">
                        <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        No riders online yet.<br />
                        <span className="text-xs">Riders appear here when they go online.</span>
                      </div>
                    ) : (
                      onlineRiders.map((rider) => (
                        <button
                          key={rider.id}
                          id={`rider-dispatch-${rider.id.slice(-4)}`}
                          onClick={() => dispatchBatch(rider.id)}
                          disabled={!selectedBatchId || dispatching}
                          className={`w-full text-left px-4 py-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                            selectedBatchId
                              ? 'bg-zinc-50 border-zinc-200 hover:bg-white hover:border-radium-green/40 hover:shadow-md cursor-pointer'
                              : 'bg-zinc-50 border-zinc-100 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-radium-green/30 flex items-center justify-center">
                              <span className="text-sm font-black text-white">
                                {(rider.full_name || 'R').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-radium-green rounded-full border-2 border-white" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-sm text-zinc-900 truncate">
                                {rider.full_name || 'Unnamed Rider'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-radium-green animate-pulse" />
                              <span className="text-[11px] text-zinc-500 font-medium">Online · Ready</span>
                            </div>
                          </div>

                          {selectedBatchId && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 group-hover:text-radium-green transition-colors">
                              {dispatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                                <><span>Dispatch</span><ChevronRight className="w-4 h-4" /></>
                              )}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

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
