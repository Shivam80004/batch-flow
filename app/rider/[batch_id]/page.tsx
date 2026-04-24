'use client'

import { useEffect, useState, useRef, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  ChevronLeft,
  ExternalLink,
  ArrowRight,
  Loader2,
  Package,
  Truck,
  MapPin,
  ChevronRight,
  Layers,
  Building2,
  Phone,
  ChevronUp,
  ChevronDown,
  LocateIcon,
  Locate,
  Map,
} from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import { parsePoint } from '@/utils/routing'
import SwipeToConfirm from '@/components/SwipeToConfirm'
import {
  calculateOptimizedSequence,
  haversineDistance,
  type BatchOrder,
  type Coordinate,
} from '@/utils/logisticsEngine'
import GoogleRiderMap, { type MapStop } from '@/components/GoogleRiderMap'

// SwiperJS
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/pagination'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ batch_id: string }>
}

type Phase = 'COLLECTING' | 'DELIVERING'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse an EWKB/WKT point from Supabase into { lat, lng } */
function safeParsePoint(pt: string): Coordinate {
  try {
    return parsePoint(pt)
  } catch {
    return { lat: 0, lng: 0 }
  }
}

/** Transform a raw Supabase order row into a BatchOrder */
function toBatchOrder(row: any): BatchOrder & { business_name?: string; business_phone?: string } {
  const pickup = safeParsePoint(row.pickup_pt)
  const drop = safeParsePoint(row.drop_pt)
  return {
    id: row.id,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    drop_lat: drop.lat,
    drop_lng: drop.lng,
    pickup_address_text: row.pickup_address || '',
    dropoff_address_text: row.drop_address || '',
    status: row.status || 'pending',
    business_name: row.tenants?.name || '',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RiderPage({ params }: PageProps) {
  const { batch_id } = use(params)
  const router = useRouter()

  // ── Core state ─────────────────────────────────────────────────────────

  // Keep a stable ref to userId for beacon callbacks (closures don't capture state updates)
  const riderIdRef = useRef<string | null>(null)

  const [allOrders, setAllOrders] = useState<BatchOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPhase, setCurrentPhase] = useState<Phase>('COLLECTING')
  const [activeIndex, setActiveIndex] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [batchComplete, setBatchComplete] = useState(false)
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null)
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied' | 'error'>('prompt')
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null)
  const swiperRef = useRef<SwiperType | null>(null)

  // ── Shutter drag state ──────────────────────────────────────────────────
  const [shutterVh, setShutterVh] = useState(48)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(false)
  const [windowHeight, setWindowHeight] = useState(800)

  useEffect(() => {
    setWindowHeight(window.innerHeight)
    const rh = () => setWindowHeight(window.innerHeight)
    window.addEventListener('resize', rh)
    return () => window.removeEventListener('resize', rh)
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const vh = ((window.innerHeight - e.clientY) / window.innerHeight) * 100
      const currentMinVh = (72 / window.innerHeight) * 100
      const clamped = Math.max(currentMinVh, Math.min(85, vh))
      setShutterVh(clamped)
    }

    const handlePointerUp = () => {
      if (dragRef.current) {
        dragRef.current = false
        setIsDragging(false)
        document.body.style.userSelect = ''
        document.body.style.touchAction = ''
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = true
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.touchAction = 'none'
  }

  const currentMinVh = (72 / windowHeight) * 100
  const isShutterOpen = shutterVh > currentMinVh + 2

  const toggleShutter = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isShutterOpen) {
      setShutterVh(currentMinVh)
    } else {
      setShutterVh(48)
    }
  }

  // ── Derived lists (pickups sorted by proximity) ─────────────────────────

  const pendingPickups = allOrders
    .filter((o) => o.status === 'pending' || o.status === 'batched')
    .sort((a, b) => {
      if (!userLocation) return 0
      const distA = haversineDistance(userLocation, { lat: a.pickup_lat, lng: a.pickup_lng })
      const distB = haversineDistance(userLocation, { lat: b.pickup_lat, lng: b.pickup_lng })
      return distA - distB
    })

  const deliveryQueue = allOrders.filter(
    (o) => o.status === 'picked_up' || o.status === 'delivering'
  )
  const activeList = currentPhase === 'COLLECTING' ? pendingPickups : deliveryQueue
  const activeOrder = activeList[activeIndex] || null

  // ── Geolocation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationErrorMessage('Geolocation is not supported by your browser.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('granted')
        setLocationErrorMessage(null)
      },
      (err) => {
        console.error('Geolocation error:', err)
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied')
          setLocationErrorMessage('Location permission denied. Please allow GPS for accurate navigation.')
        } else {
          setLocationStatus('error')
          setLocationErrorMessage('Unable to retrieve your location. Check your GPS settings.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Fetch batch data ───────────────────────────────────────────────────

  // ── Layer 2: sendBeacon on tab close / crash ────────────────────────────
  // Fires even as the tab is being destroyed so the dashboard stays accurate.
  useEffect(() => {
    const markOffline = () => {
      if (!riderIdRef.current) return
      const payload = JSON.stringify({ riderId: riderIdRef.current })
      navigator.sendBeacon('/api/rider/offline', new Blob([payload], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', markOffline)
    window.addEventListener('pagehide', markOffline)
    return () => {
      window.removeEventListener('beforeunload', markOffline)
      window.removeEventListener('pagehide', markOffline)
    }
  }, [])

  useEffect(() => {
    async function load() {
      if (!batch_id) return
      setLoading(true)

      // ── Auth + role guard ─────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Store rider ID for the beacon callback
      riderIdRef.current = user.id

      const { data: riderProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!riderProfile || riderProfile.role !== 'rider') {
        router.replace('/dashboard')
        return
      }
      // ─────────────────────────────────────────────────────────────────────

      const { data, error } = await supabase
        .from('orders')
        .select('*, tenants(name)')
        .eq('batch_id', batch_id)

      if (error) {
        console.error('Fetch error:', error)
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        let orders = data.map(toBatchOrder)

        // Find state
        const allDelivered = orders.every((o) => o.status === 'delivered')
        if (allDelivered) {
          setBatchComplete(true)
          setLoading(false)
          return
        }

        const hasPending = orders.some((o) => o.status === 'pending' || o.status === 'batched')

        // If we're already in delivery phase, optimize once on load
        if (!hasPending) {
          setCurrentPhase('DELIVERING')
          const pickedUp = orders.filter(o => o.status === 'picked_up' || o.status === 'delivering')
          if (pickedUp.length > 0) {
            // Anchor optimization to current GPS or last pickup
            const anchor = userLocation || { lat: pickedUp[0].pickup_lat, lng: pickedUp[0].pickup_lng }
            const optimized = calculateOptimizedSequence(anchor, pickedUp)
            const delivered = orders.filter(o => o.status === 'delivered')
            orders = [...delivered, ...optimized]
          }
        } else {
          setCurrentPhase('COLLECTING')
        }

        setAllOrders(orders)
      } else {
        setAllOrders([])
      }
      setLoading(false)
    }
    load()
  }, [batch_id, userLocation === null, locationStatus]) // Re-run once user location is acquired or fails

  // ── THE PIVOT: Collecting → Delivering ─────────────────────────────────

  const triggerPivot = useCallback(() => {
    const riderPos = userLocation || {
      lat: allOrders[0]?.pickup_lat || 0,
      lng: allOrders[0]?.pickup_lng || 0,
    }

    const toDeliver = allOrders.filter((o) => o.status === 'picked_up' || o.status === 'delivering')
    if (toDeliver.length === 0) return

    const optimized = calculateOptimizedSequence(riderPos, toDeliver)

    // Rebuild allOrders with optimized delivery sequence
    const deliveredOrders = allOrders.filter((o) => o.status === 'delivered')
    const pendingOrders = allOrders.filter((o) => o.status === 'pending')
    setAllOrders([...deliveredOrders, ...pendingOrders, ...optimized])
    setCurrentPhase('DELIVERING')
    setActiveIndex(0)

    if (swiperRef.current) {
      swiperRef.current.slideTo(0, 300)
    }
  }, [allOrders, userLocation])

  // ── Self-healing transition ───────────────────────────────────────────

  useEffect(() => {
    if (
      !loading &&
      !batchComplete &&
      currentPhase === 'COLLECTING' &&
      allOrders.length > 0 &&
      pendingPickups.length === 0 &&
      deliveryQueue.length > 0
    ) {
      console.log('Self-healing: No pending pickups found, triggering pivot.')
      triggerPivot()
    }
  }, [currentPhase, pendingPickups.length, deliveryQueue.length, allOrders.length, loading, batchComplete, triggerPivot])

  // ── Mark "Picked Up" ──────────────────────────────────────────────────

  const markPickedUp = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'picked_up' })
        .eq('id', orderId)
      if (error) throw error

      const updated = allOrders.map((o) =>
        o.id === orderId ? { ...o, status: 'picked_up' as const } : o
      )
      setAllOrders(updated)

      // Check if ALL pickups are done → auto-PIVOT
      const remaining = updated.filter((o) => o.status === 'pending' || o.status === 'batched')
      if (remaining.length === 0) {
        // All pickups complete — auto pivot to delivery
        setTimeout(() => {
          const riderPos = userLocation || {
            lat: updated.find((o) => o.status === 'picked_up')?.pickup_lat || 0,
            lng: updated.find((o) => o.status === 'picked_up')?.pickup_lng || 0,
          }
          const toDeliver = updated.filter((o) => o.status === 'picked_up')
          const optimized = calculateOptimizedSequence(riderPos, toDeliver)
          const delivered = updated.filter((o) => o.status === 'delivered')
          setAllOrders([...delivered, ...optimized])
          setCurrentPhase('DELIVERING')
          setActiveIndex(0)
          if (swiperRef.current) swiperRef.current.slideTo(0, 300)
        }, 600)
      } else {
        // Advance to next pickup card
        if (swiperRef.current && activeIndex < remaining.length - 1) {
          swiperRef.current.slideNext(300)
        }
      }
    } catch (err) {
      alert(`Pickup failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Mark "Delivered" ───────────────────────────────────────────────────

  const markDelivered = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId)
      if (error) throw error

      const updated = allOrders.map((o) =>
        o.id === orderId ? { ...o, status: 'delivered' as const } : o
      )
      setAllOrders(updated)

      const remaining = updated.filter(
        (o) => o.status !== 'delivered' && o.status !== 'pending'
      )

      if (remaining.length === 0) {
        // All done → complete batch
        await supabase
          .from('batches')
          .update({ status: 'completed' })
          .eq('id', batch_id)
        setBatchComplete(true)
      } else {
        // Advance to next card
        if (swiperRef.current) {
          swiperRef.current.slideNext(300)
        }
      }
    } catch (err) {
      alert(`Delivery update failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Map stop conversion ────────────────────────────────────────────────

  const toMapStop = (order: BatchOrder, index: number): MapStop => {
    const isCollecting = currentPhase === 'COLLECTING'
    return {
      id: order.id,
      lat: isCollecting ? order.pickup_lat : order.drop_lat,
      lng: isCollecting ? order.pickup_lng : order.drop_lng,
      index,
    }
  }

  const getNavUrl = (order: BatchOrder) => {
    if (currentPhase === 'COLLECTING') {
      return `https://www.google.com/maps/dir/?api=1&destination=${order.pickup_lat},${order.pickup_lng}&travelmode=driving`
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${order.drop_lat},${order.drop_lng}&travelmode=driving`
  }

  const getDistanceFromUser = (order: BatchOrder) => {
    if (!userLocation) return null
    const target: Coordinate =
      currentPhase === 'COLLECTING'
        ? { lat: order.pickup_lat, lng: order.pickup_lng }
        : { lat: order.drop_lat, lng: order.drop_lng }
    return haversineDistance(userLocation, target)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDERS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-12 h-12 text-radium-green animate-spin" />
        <p className="mt-4 text-zinc-500 font-medium tracking-tight">
          Syncing route data…
        </p>
      </div>
    )
  }

  // ── Batch complete celebration ─────────────────────────────────────────

  if (batchComplete) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans">
        <div className="w-full max-w-md h-screen md:h-[850px] md:max-h-[90vh] md:rounded-[40px] md:border-[8px] md:border-zinc-900 overflow-hidden relative shadow-2xl flex flex-col bg-zinc-950 p-6">
          {/* Animated background glow */}
          <div className="absolute w-80 h-80 bg-radium-green/15 blur-[140px] rounded-full animate-pulse" />
          <div className="absolute w-56 h-56 bg-radium-green/10 blur-[100px] rounded-full animate-pulse delay-500" />

          <div className="relative flex flex-col items-center justify-center h-full text-center z-10 animate-[fadeSlideUp_0.8s_ease-out_forwards]">
            <div className="w-28 h-28 bg-radium-green/10 border border-radium-green/30 rounded-full flex items-center justify-center mb-8 glow-emerald">
              <CheckCircle className="w-12 h-12 text-radium-green" />
            </div>

            <h1 className="text-3xl font-bold text-white mb-3 tracking-tighter">
              Batch Complete
            </h1>
            <p className="text-zinc-400 mb-3 max-w-[240px] text-sm">
              All routes finished successfully. Outstanding work.
            </p>
            <p className="text-zinc-600 mb-10 text-xs font-mono">
              ID: {batch_id.slice(0, 8).toUpperCase()}
            </p>

            <button
              onClick={() => (window.location.href = '/rider-home')}
              className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-3 backdrop-blur-md"
            >
              Dashboard Return
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main focus-mode UI ─────────────────────────────────────────────────

  const mapActiveTarget = activeOrder ? toMapStop(activeOrder, activeIndex) : null
  const mapRemainingStops = activeList
    .map((o, i) => toMapStop(o, i))
    .filter((_, i) => i !== activeIndex)

  return (
    <div className="min-h-screen overflow-hidden bg-zinc-50 flex items-center justify-center font-sans selection:bg-radium-green/30">
      <style jsx global>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .swiper-pagination-bullet {
          background: rgba(255,255,255,0.15) !important;
          opacity: 1 !important;
          width: 6px !important;
          height: 6px !important;
          border-radius: 4px !important;
          transition: all 0.3s !important;
        }
        .swiper-pagination-bullet-active {
          background: rgba(212,255,0,1) !important;
          box-shadow: 0 0 10px rgba(212,255,0,0.5);
          width: 16px !important;
        }
        .swipe-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite linear;
        }
      `}</style>

      <div className="w-full mdT:max-w-[620px] h-screen md:rounded-[40px] md:border-[8px] md:border-zinc-200 overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.1)] flex flex-col bg-zinc-50">

        {/* Background cinematic glows */}
        {/* <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-radium-green/10 blur-[100px] mix-blend-screen rounded-full"></div>
          <div className="absolute bottom-[20%] left-[-20%] w-[200px] h-[200px] bg-radium-green/10 blur-[80px] mix-blend-screen rounded-full"></div>
        </div> */}

        {/* ▬▬▬ TOP: MAP ▬▬▬ */}
        <div className="relative z-10 flex-1 w-full transition-all duration-500">
          <GoogleRiderMap
            activeTarget={mapActiveTarget}
            remainingStops={mapRemainingStops}
            userLocation={userLocation}
            phase={currentPhase}
          />

          <div className="absolute top-0 left-0 w-full h-14 bg-gradient-to-b from-white/70 pointer-events-none z-10"></div>

          {/* Header over map */}
          <div className="absolute top-6 left-5 right-5 z-20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-black/5 flex items-center justify-center text-zinc-600 hover:text-black shadow-sm transition-colors"
                style={{ backdropFilter: 'blur(24px)' }}
              >
                <ChevronLeft className="w-5 h-5 ml-[-2px]" />
              </button>
              <div className="px-3.5 py-2 bg-white/80 backdrop-blur-md rounded-full flex items-center gap-2 border border-black/5 shadow-sm">
                <div className={`w-2 h-2 rounded-full bg-radium-green`}></div>
                <span className="text-[11px] font-bold tracking-wider text-zinc-800">BATCH {batch_id.slice(-4).toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Geolocation Warning Banner */}
          {locationStatus === 'denied' && (
            <div className="absolute top-20 left-4 right-4 z-20 glass-panel border-red-500/20 rounded-2xl p-3 flex items-center gap-3 animate-[fadeSlideUp_0.5s_ease-out]">
              <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Location Disabled</p>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Proximity tracking restricted.
                  <button onClick={() => alert('UNBLOCK GPS:\n1. Click Lock icon\n2. Allow Location\n3. Retry')} className="ml-1 text-white underline underline-offset-2">How to fix?</button>
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[9px] font-bold uppercase transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Floating phase transition banner */}

          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-zinc-900/20 pointer-events-none z-10"></div>
        </div>

        {/* ▬▬▬ BOTTOM 45%: TASK SWIPER (ROLLER SHUTTER) ▬▬▬ */}
        <div
          className={`w-full flex flex-col relative z-20 rounded-t-[20px] shadow-[0_-12px_48px_rgba(0,0,0,0.15)] border-t border-white/10 bg-[#141416] text-white ${isDragging ? 'transition-none' : 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'
            } ${!isShutterOpen ? 'cursor-pointer hover:bg-[#1a1a1c]' : ''}`}
          style={{ height: `max(72px, ${shutterVh}vh)` }}
          onClick={() => !isShutterOpen && toggleShutter()}
        >
          {/* Shutter Handle */}
          <div
            className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
          </div>

          {/* Phase toggle tabs + progress */}
          <div className="flex items-center justify-between px-6 pb-4 pt-1">
            <div className="flex items-center gap-1 p-1 bg-white/5 backdrop-blur-md rounded-[14px]">
              <button
                onClick={() => { setCurrentPhase('COLLECTING'); setActiveIndex(0); swiperRef.current?.slideTo(0, 300) }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[11px] font-bold tracking-wider transition-all ${currentPhase === 'COLLECTING'
                  ? 'bg-radium-green text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Package className="w-3.5 h-3.5" />
                Pickup
                {pendingPickups.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${currentPhase === 'COLLECTING' ? 'bg-black/10 text-zinc-900' : 'bg-white/10 text-zinc-400'}`}>
                    {pendingPickups.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setCurrentPhase('DELIVERING'); setActiveIndex(0); swiperRef.current?.slideTo(0, 300) }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[11px] font-bold tracking-wider transition-all ${currentPhase === 'DELIVERING'
                  ? 'bg-radium-green text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Deliver
                {deliveryQueue.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${currentPhase === 'DELIVERING' ? 'bg-black/10 text-zinc-900' : 'bg-white/10 text-zinc-400'}`}>
                    {deliveryQueue.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 text-zinc-400">
              <span className="text-xs font-semibold font-mono bg-white/5 px-2.5 py-1.5 rounded-[10px]">
                {activeList.length > 0 ? `${activeIndex + 1}/${activeList.length}` : '0'}
              </span>
              <button
                onClick={toggleShutter}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                {isShutterOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Swiper Content area that fades out when closed */}
          <div className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-300 ${isShutterOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
            {/* Swiper or Empty State */}
            {activeList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-[fadeSlideUp_0.5s_ease-out]">
                <div className="w-16 h-16 glass-panel rounded-3xl border border-white/5 flex items-center justify-center mb-4">
                  <Layers className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-zinc-400 text-sm font-medium">No Active Tasks</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 px-6 py-2.5 glass-panel border border-white/10 rounded-xl text-xs font-medium hover:bg-white/5 transition-all"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <Swiper
                modules={[Pagination]}
                pagination={{ clickable: true }}
                spaceBetween={16}
                className="flex-1 w-full"
                onSwiper={(sw) => (swiperRef.current = sw)}
                onSlideChange={(sw) => setActiveIndex(sw.activeIndex)}
              >
                {activeList.map((order, idx) => {
                  const dist = getDistanceFromUser(order)
                  const isCollecting = currentPhase === 'COLLECTING'
                  const address = isCollecting
                    ? order.pickup_address_text
                    : order.dropoff_address_text
                  const fallback = isCollecting
                    ? `${order.pickup_lat.toFixed(5)}, ${order.pickup_lng.toFixed(5)}`
                    : `${order.drop_lat.toFixed(5)}, ${order.drop_lng.toFixed(5)}`

                  return (
                    <SwiperSlide key={order.id} className="px-6 pb-6 pt-1">
                      <div className="h-full bg-white/5 rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden group border border-white/5">

                        {/* Subdued background number */}
                        <div className="absolute top-[-10px] right-2 text-8xl font-black text-white/3 select-none pointer-events-none transition-transform group-hover:scale-110">
                          {idx + 1}
                        </div>

                        {/* Task info */}
                        <div className="space-y-4 relative z-10 w-full overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-widest ${isCollecting ? 'text-radium-green bg-radium-green/10' : 'text-zinc-300 bg-white/10'
                                }`}
                            >
                              {isCollecting ? 'Pickup' : 'Drop-off'}
                            </span>
                            <span className="text-[11px] font-mono font-medium text-zinc-400">
                              ID • {order.id.slice(-4).toUpperCase()}
                            </span>
                          </div>

                          {/* Title block */}
                          <div>
                            {isCollecting && (order as any).business_name && (
                              <p className="text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                                <Building2 className="w-3 h-3" />
                                {(order as any).business_name}
                              </p>
                            )}
                            <div className="flex items-start gap-3 w-full">
                              <MapPin
                                className={`w-5 h-5 mt-0.5 shrink-0 text-radium-green`}
                              />
                              <h2 className="md:text-2xl text-lg font-bold text-white leading-tight break-words">
                                {address || fallback}
                              </h2>
                            </div>
                          </div>

                          {/* Status bar */}
                          {/* <div className="flex items-center gap-3">
                            {dist !== null && (
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-xs font-medium text-zinc-400">
                                  {dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)} km`}
                                </span>
                              </div>
                            )}
                            <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
                            <span className="text-xs text-zinc-500 font-medium">Ready</span>
                          </div> */}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col w-full pt-4 gap-3 relative z-10">

                          {/* Swipe-to-confirm */}
                          <SwipeToConfirm
                            label={isCollecting ? 'Swipe to Confirm' : 'Swipe to Confirm'}
                            loading={updatingId === order.id}
                            onConfirm={() =>
                              isCollecting ? markPickedUp(order.id) : markDelivered(order.id)
                            }
                          />

                          {/* <div className={`flex w-fit  gap-2.5 ${isCollecting && (order as any).business_phone ? 'flex-row' : ''}`}>
                            <a
                              href={getNavUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center justify-center gap-2 flex-1 py-3.5 rounded-[14px] font-medium text-sm transition-all shadow-lg border ${isCollecting
                                ? 'bg-zinc-800/80 border-amber-500/20 p-4 text-amber-50 hover:bg-zinc-800 hover:border-amber-500/40'
                                : 'bg-[#d4ff00] border-radium-green text-zinc-950 hover:bg-radium-green-hover hover:scale-[1.02] shadow-[0_4px_20px_rgba(212,255,0,0.3)]'
                                }`}
                            >
                              <Map className="w-4 h-4" />
                              Google Maps
                            </a>
                            {isCollecting && (order as any).business_phone && (
                              <a
                                href={`tel:${(order as any).business_phone}`}
                                className="flex items-center justify-center w-14 p-5 rounded-[14px] bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div> */}
                        </div>
                      </div>
                    </SwiperSlide>
                  )
                })}
              </Swiper>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
