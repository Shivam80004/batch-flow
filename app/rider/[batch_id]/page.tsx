'use client'

import { useEffect, useState, useRef, useCallback, use } from 'react'
import {
  CheckCircle,
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
} from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import { parsePoint } from '@/utils/routing'
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
    pickup_address_text: row.pickup_address_text || '',
    dropoff_address_text: row.dropoff_address_text || '',
    status: row.status || 'pending',
    business_name: row.tenants?.name || '',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RiderPage({ params }: PageProps) {
  const { batch_id } = use(params)

  // ── Core state ─────────────────────────────────────────────────────────

  const [allOrders, setAllOrders] = useState<BatchOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPhase, setCurrentPhase] = useState<Phase>('COLLECTING')
  const [activeIndex, setActiveIndex] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [batchComplete, setBatchComplete] = useState(false)
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null)
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied' | 'error'>('prompt')
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const swiperRef = useRef<SwiperType | null>(null)

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

  useEffect(() => {
    async function load() {
      if (!batch_id) return
      setLoading(true)

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
      setConfirmingId(null)
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
      setConfirmingId(null)
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
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="mt-4 text-zinc-500 font-medium tracking-tight">
          Syncing route data…
        </p>
      </div>
    )
  }

  // ── Batch complete celebration ─────────────────────────────────────────

  if (batchComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 p-6 overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute w-80 h-80 bg-emerald-500/15 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute w-56 h-56 bg-indigo-500/10 blur-[100px] rounded-full animate-pulse delay-500" />

        <div className="relative flex flex-col items-center text-center z-10 animate-[fadeSlideUp_0.8s_ease-out_forwards]">
          <div className="w-28 h-28 bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/40 border-4 border-emerald-400/20">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>

          <h1 className="text-4xl font-black text-white mb-3 tracking-tighter">
            BATCH COMPLETE
          </h1>
          <p className="text-zinc-400 mb-3 max-w-xs text-lg font-medium">
            All deliveries were completed successfully.
          </p>
          <p className="text-zinc-600 mb-10 text-sm font-mono">
            #{batch_id.slice(0, 8)}
          </p>

          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="group relative px-10 py-5 w-full max-w-xs bg-white text-zinc-950 rounded-2xl font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            Back to Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
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
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Global styles */}
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
          width: 8px !important;
          height: 8px !important;
          border-radius: 4px !important;
          transition: all 0.3s !important;
        }
        .swiper-pagination-bullet-active {
          background: white !important;
          width: 20px !important;
        }
        .swipe-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* ▬▬▬ TOP 60%: MAP ▬▬▬ */}
      <div className="relative" style={{ height: '55%' }}>
        <GoogleRiderMap
          activeTarget={mapActiveTarget}
          remainingStops={mapRemainingStops}
          userLocation={userLocation}
          phase={currentPhase}
        />

        {/* Geolocation Warning Banner */}
        {locationStatus === 'denied' && (
          <div className="absolute top-16 left-4 right-4 z-20 bg-red-500/10 backdrop-blur-lg border border-red-500/20 rounded-2xl p-3 flex items-center gap-3 animate-[fadeSlideUp_0.5s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Location Disabled</p>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Proximity sorting and live tracking are restricted.
                <button
                  onClick={() => alert('UNBLOCK GPS:\n1. Click the Tune/Lock icon to the left of the URL.\n2. Set Location to "Allow".\n3. Click Retry.')}
                  className="ml-1 text-white underline underline-offset-2 hover:text-red-300 transition-colors"
                >
                  How to fix?
                </button>
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[9px] font-black uppercase transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Floating phase transition banner */}
        {currentPhase === 'COLLECTING' && pendingPickups.length <= 1 && pendingPickups.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-amber-500/10 backdrop-blur-lg border border-amber-500/20 rounded-2xl p-3 flex items-center gap-3 animate-[fadeSlideUp_0.5s_ease-out]">
            <Package className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-[10px] font-bold text-amber-300">
              Last pickup! Route optimization will engage after this.
            </p>
          </div>
        )}
      </div>

      {/* ▬▬▬ BOTTOM 45%: TASK SWIPER ▬▬▬ */}
      <div className="flex-1 flex flex-col relative bg-zinc-950 z-10" style={{ minHeight: '45%' }}>
        {/* Phase toggle tabs + progress */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          {/* Tabs: show both if both phases have tasks */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setCurrentPhase('COLLECTING'); setActiveIndex(0); swiperRef.current?.slideTo(0, 300) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${currentPhase === 'COLLECTING'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-600 hover:text-zinc-400'
                }`}
            >
              <Package className="w-3 h-3" />
              Pickup
              {pendingPickups.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${currentPhase === 'COLLECTING' ? 'bg-amber-500/25 text-amber-300' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                  {pendingPickups.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setCurrentPhase('DELIVERING'); setActiveIndex(0); swiperRef.current?.slideTo(0, 300) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${currentPhase === 'DELIVERING'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-600 hover:text-zinc-400'
                }`}
            >
              <Truck className="w-3 h-3" />
              Deliver
              {deliveryQueue.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${currentPhase === 'DELIVERING' ? 'bg-indigo-500/25 text-indigo-300' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                  {deliveryQueue.length}
                </span>
              )}
            </button>
          </div>

          {/* Counter */}
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-xs font-bold font-mono">
              {activeList.length > 0 ? `${activeIndex + 1}/${activeList.length}` : '0/0'}
            </span>
          </div>
        </div>

        {/* Swiper or Empty State */}
        {activeList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-[fadeSlideUp_0.5s_ease-out]">
            <div className="w-16 h-16 bg-zinc-900 rounded-3xl border border-white/5 flex items-center justify-center mb-4">
              <Layers className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-zinc-400 font-bold tracking-tight">No Active Tasks</p>
            <p className="mt-1 text-zinc-600 text-xs max-w-[200px]">
              All items for this batch have been processed or none were assigned.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2.5 bg-zinc-900 border border-white/5 rounded-full text-xs font-bold hover:bg-zinc-800 active:scale-95 transition-all"
            >
              Refresh Status
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
                <SwiperSlide key={order.id} className="px-5 pb-4 pt-2">
                  <div className="h-full bg-zinc-900 rounded-3xl border border-white/5 p-5 flex flex-col justify-between relative overflow-hidden">
                    {/* Background number */}
                    <div className="absolute top-0 right-0 py-3 px-6 text-7xl font-black text-white/5 select-none italic">
                      {idx + 1}
                    </div>

                    {/* Task info */}
                    <div className="space-y-3 relative z-10">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${isCollecting ? 'text-amber-400' : 'text-indigo-400'
                            }`}
                        >
                          {isCollecting ? 'Pickup' : 'Drop-off'} {idx + 1} of{' '}
                          {activeList.length}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-600">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                      </div>

                      {/* Business name (pickup phase only) */}
                      {isCollecting && (order as any).business_name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                          <p className="text-lg font-black text-white tracking-tight leading-none">
                            {(order as any).business_name}
                          </p>
                        </div>
                      )}

                      {/* Address */}
                      <div className="flex items-start gap-3">
                        <MapPin
                          className={`w-5 h-5 mt-0.5 shrink-0 ${isCollecting ? 'text-amber-400' : 'text-indigo-400'
                            }`}
                        />
                        <h2 className="text-xl font-black text-white leading-tight tracking-tight">
                          {address || fallback}
                        </h2>
                      </div>

                      {/* Distance badge */}
                      {dist !== null && (
                        <div className="flex items-center gap-2">
                          <Truck className="w-3 h-3 text-zinc-600" />
                          <span className="text-xs font-bold text-zinc-500">
                            {dist < 1
                              ? `${(dist * 1000).toFixed(0)}m away`
                              : `${dist.toFixed(1)} km away`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2.5 pt-3 relative z-10">
                      {/* Navigate + Call row */}
                      <div className={`flex gap-2 ${isCollecting && (order as any).business_phone ? 'flex-row' : ''}`}>
                        <a
                          href={getNavUrl(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-2.5 flex-1 py-4 rounded-2xl font-black text-base active:scale-[0.97] transition-all shadow-lg ${isCollecting
                              ? 'bg-amber-500 text-zinc-950 shadow-amber-500/25'
                              : 'bg-indigo-600 text-white shadow-indigo-600/25'
                            }`}
                        >
                          <ExternalLink className="w-5 h-5" />
                          NAVIGATE
                        </a>
                        {isCollecting && (order as any).business_phone && (
                          <a
                            href={`tel:${(order as any).business_phone}`}
                            className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black text-sm bg-zinc-800 border border-white/10 text-zinc-200 active:scale-[0.97] transition-all"
                          >
                            <Phone className="w-5 h-5" />
                          </a>
                        )}
                      </div>

                      {/* Swipe-to-confirm or button */}
                      {confirmingId === order.id ? (
                        <button
                          onClick={() =>
                            isCollecting
                              ? markPickedUp(order.id)
                              : markDelivered(order.id)
                          }
                          disabled={updatingId === order.id}
                          className="relative flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-base active:scale-[0.97] transition-all shadow-lg shadow-emerald-600/20 overflow-hidden"
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                          {updatingId === order.id
                            ? 'Updating…'
                            : `Confirm ${isCollecting ? 'Pickup' : 'Delivery'}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(order.id)}
                          className="relative flex items-center justify-center gap-2 w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold text-sm border border-white/5 active:scale-[0.97] transition-all overflow-hidden"
                        >
                          <div className="absolute inset-0 swipe-shimmer" />
                          <ChevronRight className="w-4 h-4" />
                          <span className="relative z-10">
                            {isCollecting
                              ? 'Mark Picked Up'
                              : 'Mark Delivered'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </SwiperSlide>
              )
            })}
          </Swiper>
        )}
      </div>
    </div>
  )
}
