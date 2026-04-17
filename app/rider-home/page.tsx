'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Wifi, WifiOff, MapPin, Package, Truck,
  CheckCircle, X, ArrowRight, IndianRupee, Route,
  Bell, Bike, LogOut, AlertTriangle, RefreshCw
} from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import { haversineDistance } from '@/utils/logisticsEngine'
import { parsePoint } from '@/utils/routing'

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_PAYOUT_RATE = 8
const LOCATION_UPDATE_INTERVAL_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toWkt(lat: number, lng: number) {
  return `SRID=4326;POINT(${lng} ${lat})`
}

function safeParsePoint(pt: string | null | undefined) {
  if (!pt) return null
  try { return parsePoint(pt) } catch { return null }
}

function calcBatchKm(orders: any[]) {
  return orders.reduce((total, order) => {
    const pickup = safeParsePoint(order.pickup_pt)
    const drop = safeParsePoint(order.drop_pt)
    if (pickup && drop) return total + haversineDistance(pickup, drop)
    return total
  }, 0)
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RiderHomePage() {
  const router = useRouter()

  // Auth / profile
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  // Job offer
  const [assignedBatch, setAssignedBatch] = useState<any>(null)
  const [batchOrders, setBatchOrders] = useState<any[]>([])
  const [payoutRate, setPayoutRate] = useState(DEFAULT_PAYOUT_RATE)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declineSuccess, setDeclineSuccess] = useState(false)
  const [newJobFlash, setNewJobFlash] = useState(false) // Step 2: highlights new job arrival

  // GPS
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState(false)

  // Keep a stable ref to userId so beacon callbacks can read it
  const userIdRef = useRef<string | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fetchBatchOrders = useCallback(async (batchId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('pickup_pt, drop_pt')
      .eq('batch_id', batchId)
    setBatchOrders(data || [])
  }, [])

  const applyBatch = useCallback(async (batch: any) => {
    setAssignedBatch(batch)
    setPayoutRate(batch.tenants?.payout_rate ?? DEFAULT_PAYOUT_RATE)
    await fetchBatchOrders(batch.id)
  }, [fetchBatchOrders])

  // Step 2: Play a short notification beep using Web Audio API (no external deps)
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      // Two-tone chime: high note then resolving note
      const playTone = (freq: number, startAt: number, duration: number, gain: number) => {
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()
        osc.connect(gainNode)
        gainNode.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gainNode.gain.setValueAtTime(gain, ctx.currentTime + startAt)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration)
        osc.start(ctx.currentTime + startAt)
        osc.stop(ctx.currentTime + startAt + duration)
      }
      playTone(880, 0,    0.15, 0.4)  // A5 — alert
      playTone(1100, 0.18, 0.2,  0.3)  // C#6 — resolve
      playTone(880, 0.42, 0.25, 0.25) // A5 repeat — emphasis
    } catch {
      // AudioContext may be unavailable in some environments — silent fail
    }
  }, [])

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      userIdRef.current = user.id

      // Profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // ── ROLE GUARD: only riders are allowed here ───────────────────────
      if (prof && prof.role !== 'rider') {
        router.replace('/dashboard')
        return
      }
      // ───────────────────────────────────────────────────────────

      if (!prof) {
        const { data: newProf } = await supabase
          .from('profiles')
          .insert({ id: user.id, role: 'rider', is_online: false })
          .select()
          .single()
        setProfile(newProf || { id: user.id, role: 'rider', is_online: false })
      } else {
        setProfile(prof)
      }

      // Check existing assignment
      const { data: batch } = await supabase
        .from('batches')
        .select('*, tenants(payout_rate)')
        .eq('rider_id', user.id)
        .in('status', ['assigned', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (batch) {
        if (batch.status === 'active') {
          router.push(`/rider/${batch.id}`)
          return
        }
        await applyBatch(batch)
      }

      setLoading(false)
    }
    init()

    // ── Layer 1: Auth state listener — catches token expiry / forced sign-out ──
    // When Supabase can't refresh the token it fires SIGNED_OUT. We set the
    // rider offline immediately so the dashboard never shows a ghost rider.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT' && userIdRef.current) {
          await supabase
            .from('profiles')
            .update({ is_online: false })
            .eq('id', userIdRef.current)
          // Clear the ref so we don't double-fire
          userIdRef.current = null
        }
      }
    )

    return () => { subscription.unsubscribe() }
  }, [router, applyBatch])

  // ── Realtime: batch subscription with notification sound (Step 2) ────────────
  // FIX: Supabase realtime UPDATE filter requires the filter to be true BEFORE
  // the update too (old row). Since rider_id is NULL before assignment, we subscribe
  // to ALL batch updates and filter client-side by rider_id matching our userId.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`rider-batch-watch-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT + UPDATE + DELETE
          schema: 'public',
          table: 'batches',
        },
        async (payload) => {
          const row = payload.new as any
          if (!row || row.rider_id !== userId) return // not for us

          const newStatus = row.status

          if (newStatus === 'assigned') {
            // Fetch full batch with tenant join
            const { data: batch } = await supabase
              .from('batches')
              .select('*, tenants(payout_rate)')
              .eq('id', row.id)
              .single()
            if (batch) {
              await applyBatch(batch)
              // ── Step 2: Play sound + flash the job card ────────────────────
              playNotificationSound()
              setNewJobFlash(true)
              setTimeout(() => setNewJobFlash(false), 2000)
            }
          } else if (newStatus === 'active') {
            router.push(`/rider/${row.id}`)
          } else if (newStatus === 'unassigned') {
            setAssignedBatch(null)
            setBatchOrders([])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, router, applyBatch, playNotificationSound])

  // ── Layer 2: Tab close / refresh / crash — sendBeacon ───────────────────────
  // navigator.sendBeacon is the ONLY reliable way to fire a network request
  // as a tab is closing. We post to our service-role API route which can set
  // is_online = false even after the JWT has expired.
  useEffect(() => {
    const markOffline = () => {
      if (!userIdRef.current) return
      const payload = JSON.stringify({ riderId: userIdRef.current })
      // sendBeacon — fires even as tab closes, browser queues it
      navigator.sendBeacon('/api/rider/offline', new Blob([payload], { type: 'application/json' }))
    }

    const handleVisibilityChange = () => {
      // When the document becomes hidden (phone lock screen, tab switch)
      // we don't mark offline yet, but we do on 'pagehide' / 'beforeunload'
    }

    window.addEventListener('beforeunload', markOffline)
    window.addEventListener('pagehide', markOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', markOffline)
      window.removeEventListener('pagehide', markOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ── GPS tracking ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.is_online || !userId) return
    setGpsError(false)

    const updateLocation = async () => {
      if (!lastPosRef.current) return
      const { lat, lng } = lastPosRef.current
      // Update location + heartbeat timestamp together so the DB cron can
      // auto-expire riders whose app has crashed or been force-closed.
      await supabase
        .from('profiles')
        .update({ last_location: toWkt(lat, lng), last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    }

    if (!navigator.geolocation) {
      setGpsError(true)
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGpsError(false)
      },
      (err) => {
        console.error('GPS error:', err)
        setGpsError(true)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )

    updateLocation()
    timerRef.current = setInterval(updateLocation, LOCATION_UPDATE_INTERVAL_MS)

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      watchIdRef.current = null
      timerRef.current = null
    }
  }, [profile?.is_online, userId])

  // ── Toggle online / offline ──────────────────────────────────────────────────
  const handleToggleOnline = async () => {
    if (!userId || !profile) return
    setToggling(true)
    const next = !profile.is_online

    // If going offline, stop GPS immediately
    if (!next) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      watchIdRef.current = null
      timerRef.current = null
      lastPosRef.current = null
      setGpsError(false)
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_online: next })
      .eq('id', userId)
    if (!error) setProfile((p: any) => ({ ...p, is_online: next }))
    setToggling(false)
  }

  // ── Accept job ───────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!assignedBatch) return
    setAccepting(true)
    const { error } = await supabase
      .from('batches')
      .update({ status: 'active' })
      .eq('id', assignedBatch.id)
    if (error) {
      alert('Failed to accept job: ' + error.message)
      setAccepting(false)
      return
    }
    router.push(`/rider/${assignedBatch.id}`)
  }

  // ── Decline job ──────────────────────────────────────────────────────────────
  // Uses a server API route with service-role key to bypass the RLS WITH CHECK
  // restriction that blocks riders from setting rider_id = null directly.
  const handleDecline = async () => {
    if (!assignedBatch || !userId) return
    setDeclining(true)

    try {
      const res = await fetch('/api/rider/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: assignedBatch.id, riderId: userId }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert('Failed to decline: ' + (data.error || 'Unknown error'))
        setDeclining(false)
        return
      }

      setAssignedBatch(null)
      setBatchOrders([])
      setDeclineSuccess(true)
      setTimeout(() => setDeclineSuccess(false), 3000)
    } catch (err) {
      alert('Failed to decline: Network error')
    } finally {
      setDeclining(false)
    }
  }

  const handleLogout = async () => {
    // ── Layer 3: Explicit logout — always set offline first ──────────────────
    // This is the most reliable path. We update is_online before signOut so
    // the RLS session is still valid when we make the DB call.
    if (userId) {
      await supabase
        .from('profiles')
        .update({ is_online: false })
        .eq('id', userId)
      userIdRef.current = null // prevent double-fire from auth state listener
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const estimatedKm = calcBatchKm(batchOrders)
  const estimatedPayout = Math.round(estimatedKm * payoutRate)
  const isOnline = profile?.is_online ?? false

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-radium-green animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  JOB OFFER STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (assignedBatch) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans p-4">
        <style jsx global>{`
          @keyframes offerSlideUp {
            from { opacity: 0; transform: translateY(40px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseBorder {
            0%, 100% { box-shadow: 0 0 0 0 rgba(212,255,0,0.4); }
            50%  { box-shadow: 0 0 0 12px rgba(212,255,0,0); }
          }
          @keyframes flashRing {
            0%   { box-shadow: 0 0 0 0   rgba(212,255,0,0.9); }
            40%  { box-shadow: 0 0 0 20px rgba(212,255,0,0.2); }
            100% { box-shadow: 0 0 0 0   rgba(212,255,0,0); }
          }
        `}</style>

        {/* Glows */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vh] bg-radium-green/10 blur-[130px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vh] bg-amber-500/8 blur-[130px] rounded-full" />
        </div>

        <div
          className="relative z-10 w-full max-w-md"
          style={{
            animation: 'offerSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
            ...(newJobFlash ? { animation: 'offerSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards, flashRing 0.6s ease-out 3' } : {}),
          }}
        >
          {/* Alert badge */}
          <div className="flex items-center justify-center mb-6">
            <div
              className="flex items-center gap-2 px-4 py-2 bg-radium-green/10 border border-radium-green/30 rounded-full"
              style={{ animation: 'pulseBorder 2s infinite' }}
            >
              <Bell className="w-4 h-4 text-radium-green animate-bounce" />
              <span className="text-radium-green text-xs font-bold uppercase tracking-widest">New Job Offer</span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-zinc-900 border border-white/8 rounded-[32px] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-7 border-b border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-radium-green/10 border border-radium-green/20 flex items-center justify-center">
                    <Package className="w-4 h-4 text-radium-green" />
                  </div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Batch Assignment</span>
                </div>
                <span className="font-mono text-xs text-zinc-600 bg-zinc-800 px-2.5 py-1 rounded-lg">
                  #{assignedBatch.id.slice(-6).toUpperCase()}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Truck className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Stops</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{batchOrders.length}</span>
                  <span className="text-[10px] text-zinc-600">deliveries</span>
                </div>

                <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Route className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Est. Km</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{estimatedKm.toFixed(1)}</span>
                  <span className="text-[10px] text-zinc-600">kilometers</span>
                </div>

                <div className="bg-radium-green/10 border border-radium-green/20 rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <IndianRupee className="w-3.5 h-3.5 text-radium-green" />
                    <span className="text-[10px] text-radium-green font-semibold uppercase tracking-wider">Payout</span>
                  </div>
                  <span className="text-2xl font-bold text-radium-green">₹{estimatedPayout}</span>
                  <span className="text-[10px] text-zinc-600">@ ₹{payoutRate}/km</span>
                </div>
              </div>
            </div>

            {/* Route preview */}
            {batchOrders.length > 0 && (
              <div className="px-7 py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">Route Preview</p>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-radium-green" />
                    <span className="text-xs text-zinc-400">Your location</span>
                  </div>
                  {batchOrders.slice(0, 3).map((_, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-zinc-700" />
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-zinc-400">{i + 1}</span>
                      </div>
                    </div>
                  ))}
                  {batchOrders.length > 3 && (
                    <span className="text-[10px] text-zinc-600 ml-1">+{batchOrders.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="p-6 flex flex-col gap-3">
              <button
                id="accept-job-btn"
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-4 bg-radium-green hover:bg-radium-green-hover text-zinc-950 rounded-[18px] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_24px_rgba(212,255,0,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {accepting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Starting route…</>
                ) : (
                  <><CheckCircle className="w-5 h-5" /> Accept Job</>
                )}
              </button>

              <button
                id="decline-job-btn"
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-[18px] font-semibold text-sm flex items-center justify-center gap-2 transition-all border border-white/5 disabled:opacity-60"
              >
                {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Decline
              </button>

              <p className="text-center text-[10px] text-zinc-600 mt-1">
                Declining returns the batch to the unassigned queue.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  ONLINE / OFFLINE TOGGLE STATE
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans">
      <style jsx global>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1);   }
          50%       { opacity: 0.8; transform: scale(1.05);}
        }
        .glow-btn-online {
          box-shadow:
            0 0 40px rgba(212,255,0,0.35),
            0 0 80px rgba(212,255,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .glow-btn-offline {
          box-shadow:
            0 8px 40px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Fixed glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {isOnline && (
          <>
            <div className="absolute top-[-15%] right-[-15%] w-[60vw] h-[60vh] bg-radium-green/12 blur-[150px] rounded-full" style={{ animation: 'breathe 4s ease-in-out infinite' }} />
            <div className="absolute bottom-[-15%] left-[-15%] w-[40vw] h-[40vh] bg-emerald-600/8 blur-[130px] rounded-full" style={{ animation: 'breathe 6s ease-in-out infinite' }} />
          </>
        )}
        {!isOnline && (
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] bg-zinc-800/30 blur-[150px] rounded-full" />
        )}
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-radium-green/10 border border-radium-green/20 flex items-center justify-center">
            <Bike className="w-4 h-4 text-radium-green" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">BatchFlow</p>
            <p className="text-zinc-600 text-[10px] mt-0.5">Rider Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${isOnline
              ? 'bg-radium-green/10 border-radium-green/30 text-radium-green'
              : 'bg-zinc-900 border-white/8 text-zinc-600'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-radium-green animate-pulse' : 'bg-zinc-700'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>

          {profile?.full_name && (
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
              <span className="text-[11px] font-bold text-zinc-300">{profile.full_name.charAt(0).toUpperCase()}</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-white/8 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* GPS warning banner */}
      {isOnline && gpsError && (
        <div
          className="relative z-10 mx-6 mt-2 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
          style={{ animation: 'slideDown 0.3s ease-out' }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 font-medium flex-1">Location access blocked. Allow GPS so dispatchers can find you.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[10px] font-bold text-amber-400 underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Decline success notification */}
      {declineSuccess && (
        <div
          className="relative z-10 mx-6 mt-2 flex items-center gap-3 px-4 py-3 bg-zinc-800 border border-white/10 rounded-2xl"
          style={{ animation: 'slideDown 0.3s ease-out' }}
        >
          <CheckCircle className="w-4 h-4 text-radium-green shrink-0" />
          <p className="text-xs text-zinc-300 font-medium">Batch declined. Waiting for the next offer…</p>
        </div>
      )}

      {/* Main body */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">

        {profile?.full_name && (
          <p className="text-zinc-500 text-sm font-medium mb-12 text-center">
            Hey, <span className="text-white font-bold">{profile.full_name}</span> 👋
          </p>
        )}

        {/* Big toggle button */}
        <div className="relative flex items-center justify-center mb-12">
          {isOnline && (
            <>
              <div className="absolute w-48 h-48 rounded-full border-2 border-radium-green/20 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute w-64 h-64 rounded-full border border-radium-green/10 animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
            </>
          )}

          <button
            id="rider-online-toggle"
            onClick={handleToggleOnline}
            disabled={toggling}
            className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center gap-3 font-bold text-base transition-all duration-700 ease-out disabled:cursor-not-allowed ${isOnline
                ? 'bg-radium-green text-zinc-950 glow-btn-online scale-100 hover:scale-105'
                : 'bg-zinc-900 border-2 border-white/10 text-white glow-btn-offline hover:border-white/20 hover:scale-105'
              }`}
          >
            {toggling ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : isOnline ? (
              <>
                <Wifi className="w-10 h-10" />
                <span className="text-zinc-950 text-sm font-black uppercase tracking-wide">Online</span>
                <span className="text-zinc-800 text-[10px] font-semibold">Tap to go offline</span>
              </>
            ) : (
              <>
                <WifiOff className="w-10 h-10 text-zinc-500" />
                <span className="text-white text-sm font-black uppercase tracking-wide">Go Online</span>
                <span className="text-zinc-600 text-[10px] font-semibold">Start receiving jobs</span>
              </>
            )}
          </button>
        </div>

        {/* Status description */}
        <div className="text-center max-w-xs">
          {isOnline ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <MapPin className={`w-4 h-4 ${gpsError ? 'text-amber-400' : 'text-radium-green'}`} />
                <span className={`text-sm font-bold ${gpsError ? 'text-amber-400' : 'text-white'}`}>
                  {gpsError ? 'GPS unavailable' : 'Location tracking active'}
                </span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed">
                You're visible to dispatchers.{' '}
                {gpsError
                  ? 'Enable location permissions in your browser for accurate tracking.'
                  : 'Your location updates every 30 seconds. Job offers will appear automatically.'}
              </p>

              <div className="mt-6 p-4 bg-zinc-900/60 border w-fit mx-auto border-white/5 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-radium-green animate-pulse shrink-0" />
                <p className="text-xs text-zinc-400 text-left">Waiting for a batch to be assigned…</p>
              </div>
            </>
          ) : (
            <p className="text-zinc-600 text-sm leading-relaxed">
              You're offline. Tap the button above to go online and start receiving job offers from dispatchers.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
