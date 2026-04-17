'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlusCircle, RefreshCw, PackagePlus,
  Box, User, LogOut, X, Layers, ChevronRight,
  Radio, IndianRupee, CheckCircle2, Zap, Clock
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

      // ── ROLE GUARD: riders are not allowed here ──────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', activeUser.id)
        .maybeSingle()

      if (profile?.role === 'rider') {
        router.replace('/rider-home')
        return
      }
      // ─────────────────────────────────────────────────────────────────────

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, payout_rate')
        .eq('owner_id', activeUser.id)
        .single()

      if (!tenant) { router.replace('/login'); return }

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
  // FIX: show both 'assigned' (rider accepted offer) and 'active' (in delivery)
  const fetchData = useCallback(async () => {
    if (!activeTenantId) return
    setLoading(true)
    try {
      const [{ data: pendingOrders }, { data: activeBatches }] = await Promise.all([
        supabase.from('orders').select('*, tenants(name)').eq('status', 'pending').eq('tenant_id', activeTenantId),
        supabase
          .from('batches')
          .select('*, tenants(name), profiles(full_name)')
          .in('status', ['assigned', 'active'])
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: true }),
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
      // Fetch unassigned batches + riders who are online AND have no current assignment
      const [{ data: uBatches }, { data: allOnlineRiders }, { data: busyRiders }] = await Promise.all([
        supabase
          .from('batches')
          .select('id, created_at, status')
          .eq('status', 'unassigned')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, is_online')
          .eq('is_online', true)
          .eq('role', 'rider'),
        // FIX: exclude riders who already have an assigned/active batch
        supabase
          .from('batches')
          .select('rider_id')
          .in('status', ['assigned', 'active'])
          .not('rider_id', 'is', null),
      ])
      const busyRiderIds = new Set((busyRiders || []).map((b: any) => b.rider_id))
      const availableRiders = (allOnlineRiders || []).filter((r: any) => !busyRiderIds.has(r.id))
      setUnassignedBatches(uBatches || [])
      setOnlineRiders(availableRiders)
    } finally {
      setDispatchLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    if (activeTab === 'dispatch' && activeTenantId) fetchDispatchData()
  }, [activeTab, activeTenantId, fetchDispatchData])

  // ── Realtime: persistent channel, never torn down on tab switch ────────────
  // KEY FIXES:
  // 1. activeTab removed from deps — tab changes no longer kill/rebuild channel
  // 2. fetchData/fetchDispatchData kept in refs — closures never go stale
  // 3. profiles UPDATE always patches onlineRiders regardless of active tab
  const fetchDispatchDataRef = useRef(fetchDispatchData)
  useEffect(() => { fetchDispatchDataRef.current = fetchDispatchData }, [fetchDispatchData])
  const fetchDataRef = useRef(fetchData)
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])

  useEffect(() => {
    if (!activeTenantId) return

    const channel = supabase
      .channel(`admin-realtime-${activeTenantId}`)
      // ── Batch changes: re-fetch both views ───────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => {
        fetchDataRef.current()
        fetchDispatchDataRef.current()
      })
      // ── Profile UPDATE: patch rider list in-place ─────────────────────────
      // Now works because REPLICA IDENTITY FULL sends all columns in payload.new
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as any
          if (!updated?.id) return
          if (updated.role && updated.role !== 'rider') return // ignore non-riders

          setOnlineRiders((prev) => {
            const wasInList = prev.some((r) => r.id === updated.id)

            if (updated.is_online === true && !wasInList) {
              // Rider came online — add immediately
              return [...prev, { id: updated.id, full_name: updated.full_name, is_online: true }]
            } else if (updated.is_online === false && wasInList) {
              // Rider went offline — remove immediately
              return prev.filter((r) => r.id !== updated.id)
            } else if (wasInList) {
              // Other field changed — update in-place
              return prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r)
            }
            return prev
          })
        }
      )
      .subscribe((status, err) => {
        console.log(`[realtime] admin channel status: ${status}`, err || '')
        if (status === 'SUBSCRIBED') {
          console.log('[realtime] ✅ WebSocket connected — listening for profiles + batches changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[realtime] ❌ Channel error:', err)
          fetchDispatchDataRef.current()
        } else if (status === 'TIMED_OUT') {
          console.warn('[realtime] ⚠️ Channel timed out — will retry')
        } else if (status === 'CLOSED') {
          console.warn('[realtime] 🔌 Channel closed')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [activeTenantId]) // ← only re-create when tenant changes


  // ── Dispatch a batch (Step 3: Optimistic UI) ──────────────────────────────
  // Immediately removes the batch from the local unassigned list so the UI
  // feels instant. If the server call fails, we restore the previous state
  // and show an error toast.
  const dispatchBatch = async (riderId: string) => {
    if (!selectedBatchId) { setToast('Select a batch first'); return }
    setDispatching(true)

    // ── Snapshot current state for rollback ───────────────────────────────
    const prevUnassigned = unassignedBatches
    const prevOnlineRiders = onlineRiders
    const batchBeingDispatched = selectedBatchId

    // ── Optimistic update: remove batch + rider from lists immediately ────
    setUnassignedBatches((prev) => prev.filter((b) => b.id !== batchBeingDispatched))
    setOnlineRiders((prev) => prev.filter((r) => r.id !== riderId))
    setSelectedBatchId(null)

    try {
      const { error } = await supabase
        .from('batches')
        .update({ rider_id: riderId, status: 'assigned' })
        .eq('id', batchBeingDispatched)

      if (error) throw new Error(error.message)

      setToast('Batch dispatched to rider successfully!')
    } catch (err) {
      // ── Rollback on failure ────────────────────────────────────────────
      setUnassignedBatches(prevUnassigned)
      setOnlineRiders(prevOnlineRiders)
      setSelectedBatchId(batchBeingDispatched)
      setToast(`Dispatch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDispatching(false)
    }
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
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-hidden font-sans selection:bg-radium-green/30 selection:text-zinc-950">
      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) translateX(-50%); }
          to   { opacity: 1; transform: translateY(0)   translateX(-50%); }
        }
      `}</style>

      {/* Background glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-radium-green/10 blur-[150px] mix-blend-screen rounded-full animate-float" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-blue-900/10 blur-[150px] mix-blend-screen rounded-full animate-float-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,255,0,0.03)_0%,rgba(9,9,11,1)_100%)]" />
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="relative z-10 flex h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">

          {/* Top Bar */}
          <div className="flex flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm">Dashboard</h1>
              <p className="text-zinc-400 text-sm mt-1 font-medium">{businessName || 'Logistics operations overview'}</p>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-11 h-11 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-center hover:border-radium-green/50 transition-all hover:scale-105"
              >
                <User className="w-5 h-5 text-zinc-300" />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-3 w-56 bg-zinc-950/95 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-2xl p-2 flex flex-col z-50">
                  <div className="px-4 py-3 border-b border-white/5 mb-2 relative">
                    <button onClick={() => setShowProfileMenu(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300">
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-sm font-bold text-white truncate pr-4">{businessName || 'Business'}</p>
                    <p className="text-[11px] font-medium text-zinc-500 truncate pr-4 mt-0.5">{userEmail || ''}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-left px-4 py-3 text-sm font-bold text-red-400 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 mb-10">
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-5 py-3.5 bg-zinc-900 border border-white/10 hover:border-white/20 hover:bg-zinc-800 text-white rounded-[18px] text-sm font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4 text-radium-green" /> Add Order
            </button>
            <button
              onClick={generateBatches}
              disabled={generating}
              className="px-5 py-3.5 bg-radium-green hover:bg-radium-green-hover disabled:opacity-50 text-zinc-950 rounded-[18px] text-sm font-bold transition-all shadow-[0_0_20px_rgba(212,255,0,0.2)] flex items-center gap-2 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-2">
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {generating ? 'Generating...' : 'Compute Routes'}
              </span>
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/50 backdrop-blur-md rounded-[20px] w-fit mb-10 border border-white/5">
            {(['overview', 'dispatch'] as Tab[]).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-[16px] text-sm font-bold tracking-wide transition-all capitalize ${activeTab === tab
                  ? 'bg-zinc-800 text-white shadow-lg border border-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
              >
                {tab === 'dispatch' && (
                  <span className="relative flex h-2 w-2">
                    {onlineRiders.length > 0 && activeTab !== 'dispatch' && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-radium-green opacity-75 animate-ping" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${onlineRiders.length > 0 ? 'bg-radium-green' : 'bg-zinc-700'}`} />
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
                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] p-6 relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-radium-green/5 blur-[50px] rounded-full group-hover:bg-radium-green/10 transition-all duration-500" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-zinc-500 text-sm font-bold">Pending Orders</h3>
                    <span className="text-[10px] font-bold text-zinc-950 bg-radium-green px-2 py-1 rounded-md drop-shadow-md">+5.2%</span>
                  </div>
                  <div className="text-5xl font-black mb-2 text-white tracking-tight">{loading ? '--' : orders.length}</div>
                  {!loading && orders.length > 0 && (
                    <p className="text-xs text-zinc-500 font-medium">{orders.length} order{orders.length !== 1 ? 's' : ''} awaiting batching</p>
                  )}
                  <div className="w-full h-10 mt-6 flex items-end gap-1.5 opacity-60">
                    {[4, 7, 3, 8, 5, 9, 6, 10].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/5 rounded-t-sm group-hover:bg-radium-green/80 transition-all duration-500" style={{ height: `${h * 10}%` }} />
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] p-6 relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full group-hover:bg-blue-500/10 transition-all duration-500" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-zinc-500 text-sm font-bold">Active Deliveries</h3>
                    <span className="text-[10px] font-bold text-zinc-950 bg-radium-green px-2 py-1 rounded-md drop-shadow-md">+10.1%</span>
                  </div>
                  <div className="text-5xl font-black mb-2 text-white tracking-tight">{loading ? '--' : batches.length * 4}</div>
                  <div className="relative w-full h-14 mt-4">
                    <svg className="absolute w-full h-full opacity-60 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10 L100,30 L0,30 Z" fill="url(#grad2)" />
                      <path d="M0,25 C10,15 20,30 30,20 C40,10 50,25 60,15 C70,5 80,20 100,10" fill="none" stroke="#d4ff00" strokeWidth="1.5" />
                      <defs>
                        <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(212,255,0,0.15)" />
                          <stop offset="100%" stopColor="rgba(212,255,0,0)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] p-6 relative overflow-hidden group shadow-2xl flex flex-col justify-between">
                  <div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full group-hover:bg-indigo-500/10 transition-all duration-500" />
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-zinc-500 text-sm font-bold">Active Batches</h3>
                    </div>
                    <div className="text-5xl font-black mb-3 text-white tracking-tight">{loading ? '--' : batches.length}</div>
                  </div>
                  <div>
                    <div className="w-full bg-zinc-950 border border-white/5 shadow-inner rounded-full h-2 mt-8 overflow-hidden">
                      <div className="bg-radium-green h-full w-[60%] glow-radium rounded-full" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-500 mt-3 text-right uppercase tracking-wider">In Progress</p>
                  </div>
                </div>
              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">
                {/* Pending Orders */}
                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] overflow-hidden w-full mb-4 shadow-2xl flex flex-col">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white tracking-wide">Pending Orders</h2>
                  </div>
                  <div className="overflow-x-auto w-full flex-1">
                    <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                      <thead className="bg-zinc-900/80 text-zinc-500 text-[11px] font-black uppercase tracking-[0.1em]">
                        <tr>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Status</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Customer</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Destination</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
                        {orders.length === 0 ? (
                          <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500 font-bold">No pending orders found.</td></tr>
                        ) : (
                          orders.map((order) => (
                            <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-2 py-1 bg-zinc-800 border border-white/10 text-zinc-400 text-[10px] uppercase font-bold rounded-lg shadow-sm">Pending</span>
                              </td>
                              <td className="px-6 py-4 text-center text-zinc-200">{order.sender_name || 'N/A'}</td>
                              <td className="px-6 py-4 text-zinc-400 text-xs truncate max-w-[120px] text-center">{order.receiver_name}</td>
                              <td className="px-6 py-4 font-mono text-[11px] text-zinc-500 text-center">{shortId(order.id)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Batches */}
                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] overflow-hidden w-full mb-4 shadow-2xl flex flex-col">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white tracking-wide">Active Batches</h2>
                    <span className="text-[10px] font-bold bg-white/10 text-zinc-300 px-2.5 py-1 rounded-lg border border-white/5">{batches.length} total</span>
                  </div>
                  <div className="overflow-x-auto w-full flex-1">
                    <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                      <thead className="bg-zinc-900/80 text-zinc-500 text-[11px] font-black uppercase tracking-[0.1em]">
                        <tr>
                          <th className="px-6 py-4 border-b border-white/5 text-center">View</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">ID</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Rider</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Status</th>
                          <th className="px-6 py-4 border-b border-white/5 text-center">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
                        {batches.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-bold">No active batches.</td></tr>
                        ) : (
                          batches.map((batch) => (
                            <tr key={batch.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 text-center">
                                <a href={`/rider/${batch.id}`} className="text-[10px] px-4 py-2 rounded-xl bg-radium-green text-zinc-950 hover:bg-radium-green-hover transition-all font-bold inline-block shadow-[0_0_10px_rgba(212,255,0,0.1)]">Track</a>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-zinc-500 text-center">{shortId(batch.id)}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                                    <User className="w-4 h-4 text-zinc-400" />
                                  </div>
                                  <span className="text-xs font-bold text-zinc-200">{(batch as any).profiles?.full_name || 'Assigned'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {batch.status === 'assigned' ? (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                                    <Clock className="w-3.5 h-3.5" /> Offer Sent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-radium-green bg-radium-green/10 border border-radium-green/20 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-zinc-500 text-xs text-center font-bold tracking-wide">{new Date(batch.created_at).toLocaleDateString()}</td>
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
              <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] shrink-0 shadow-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-radium-green/5 blur-[50px] rounded-full group-hover:bg-radium-green/10 transition-all duration-500" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-radium-green/10 border border-radium-green/20 flex items-center justify-center">
                    <IndianRupee className="w-5 h-5 text-radium-green" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-wide">Payout Rate</p>
                    <p className="text-[11px] text-zinc-400 font-medium">Riders earn this per km delivered</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto relative z-10 w-full sm:w-auto mt-2 sm:mt-0">
                  <div className="relative flex-1 sm:flex-none">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">₹</span>
                    <input
                      id="payout-rate-input"
                      type="number"
                      min={1}
                      max={999}
                      step={0.5}
                      value={payoutRate}
                      onChange={(e) => setPayoutRate(Number(e.target.value))}
                      className="w-full sm:w-32 pl-8 pr-4 py-3 bg-zinc-950 border border-white/10 rounded-[14px] text-white font-bold text-center text-sm focus:outline-none focus:border-radium-green focus:bg-zinc-900 transition-all"
                    />
                  </div>
                  <span className="text-zinc-500 text-sm font-medium">/ km</span>
                  <button
                    id="save-payout-rate-btn"
                    onClick={savePayoutRate}
                    disabled={savingRate}
                    className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[14px] text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-60 shadow-lg"
                  >
                    {savingRate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-radium-green" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Instruction banner */}
              {!selectedBatchId && (
                <div className="flex items-center gap-3 px-6 py-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[20px] mb-8 text-sm text-indigo-300 font-medium tracking-wide shadow-lg">
                  <Zap className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Select a batch from the left, then click a rider on the right to dispatch.</span>
                </div>
              )}
              {selectedBatchId && (
                <div className="flex items-center gap-3 px-6 py-4 bg-radium-green/10 border border-radium-green/30 rounded-[20px] mb-8 text-sm text-white font-medium tracking-wide shadow-[0_0_20px_rgba(212,255,0,0.1)]">
                  <CheckCircle2 className="w-5 h-5 text-radium-green shrink-0" />
                  <span>Batch <strong className="text-radium-green mx-1">{shortId(selectedBatchId)}</strong> selected — now click a rider to dispatch!</span>
                  <button onClick={() => setSelectedBatchId(null)} className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Two-column dispatch layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* LEFT: Unassigned Batches */}
                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] overflow-hidden shadow-2xl flex flex-col h-auto">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-zinc-400" />
                      <h2 className="text-base font-bold text-white tracking-wide">Unassigned Batches</h2>
                      <span className="text-[10px] font-bold bg-white/10 text-zinc-300 px-2.5 py-1 rounded-lg border border-white/5">
                        {unassignedBatches.length}
                      </span>
                    </div>
                    <button
                      onClick={fetchDispatchData}
                      disabled={dispatchLoading}
                      className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors border border-white/5"
                    >
                      <RefreshCw className={`w-4 h-4 text-zinc-300 ${dispatchLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto min-h-0">
                    {dispatchLoading ? (
                      <div className="py-20 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                      </div>
                    ) : unassignedBatches.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-center text-zinc-500">
                        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
                          <Layers className="w-8 h-8 opacity-30" />
                        </div>
                        <p className="text-sm font-medium mb-1">No unassigned batches</p>
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
                            className={`w-full text-left px-5 py-5 rounded-[20px] transition-all flex items-center gap-4 group relative overflow-hidden ${isSelected
                              ? 'bg-radium-green/10 border border-radium-green/40 shadow-[0_0_20px_rgba(212,255,0,0.05)]'
                              : 'bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 hover:border-white/10'
                              }`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-radium-green text-zinc-950' : 'bg-zinc-900 border border-white/5 text-zinc-400'
                              }`}>
                              <Box className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1.5">
                                <span className="font-black text-base text-white tracking-wide">{shortId(batch.id)}</span>
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-lg uppercase tracking-wider">Unassigned</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 font-medium">
                                Created {new Date(batch.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="shrink-0 flex items-center justify-center w-8 h-8">
                              {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-radium-green" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-zinc-400 transition-colors" />
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: Online Riders */}
                <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[28px] overflow-hidden shadow-2xl flex flex-col h-auto relative">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Radio className="w-5 h-5 text-radium-green animate-pulse drop-shadow-[0_0_10px_rgba(212,255,0,0.5)]" />
                      <h2 className="text-base font-bold text-white tracking-wide">Available Riders</h2>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border tracking-wider uppercase ${onlineRiders.length > 0
                        ? 'bg-radium-green/10 text-radium-green border-radium-green/20'
                        : 'bg-zinc-800 text-zinc-400 border-white/5'
                        }`}>
                        {onlineRiders.length} online
                      </span>
                    </div>
                    <button
                      onClick={fetchDispatchData}
                      className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors border border-white/5"
                    >
                      <RefreshCw className="w-4 h-4 text-zinc-300" />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto min-h-0">
                    {onlineRiders.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-center text-zinc-500">
                        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
                          <Radio className="w-8 h-8 opacity-30" />
                        </div>
                        <p className="text-sm font-medium mb-1">No riders online yet</p>
                        <span className="text-xs">Riders appear here when they go online.</span>
                      </div>
                    ) : (
                      onlineRiders.map((rider) => (
                        <button
                          key={rider.id}
                          id={`rider-dispatch-${rider.id.slice(-4)}`}
                          onClick={() => dispatchBatch(rider.id)}
                          disabled={!selectedBatchId || dispatching}
                          className={`w-full text-left px-5 py-5 rounded-[20px] transition-all flex items-center gap-4 group ${selectedBatchId
                            ? 'bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 hover:border-radium-green/50 cursor-pointer shadow-md'
                            : 'bg-zinc-900/50 border border-white/5 opacity-60 cursor-not-allowed'
                            }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-zinc-950 border-2 border-white/10 flex items-center justify-center group-hover:border-radium-green/50 transition-colors">
                              <span className="text-lg font-black text-white">
                                {(rider.full_name || 'R').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-radium-green rounded-full border-2 border-zinc-950 animate-pulse" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-base text-white tracking-wide truncate">
                                {rider.full_name || 'Unnamed Rider'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-radium-green" />
                              <span className="text-xs text-zinc-400 font-medium tracking-wide">Online · Ready</span>
                            </div>
                          </div>

                          {selectedBatchId && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 group-hover:text-radium-green transition-colors uppercase tracking-wider bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/5">
                              {dispatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                                <><span>Dispatch</span><ChevronRight className="w-4 h-4 ml-1" /></>
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
