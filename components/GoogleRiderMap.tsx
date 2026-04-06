'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MapStop {
  id: string
  lat: number
  lng: number
  label?: string
  index: number
}

interface GoogleRiderMapProps {
  activeTarget: MapStop | null
  remainingStops: MapStop[]
  userLocation: { lat: number; lng: number } | null
  phase: 'COLLECTING' | 'DELIVERING'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || ''

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#636e88' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#555580' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a4a' }] },
]

let optionsSet = false

// ─── Component ───────────────────────────────────────────────────────────────

export default function GoogleRiderMap({
  activeTarget,
  remainingStops,
  userLocation,
  phase,
}: GoogleRiderMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const remainingPolyRef = useRef<google.maps.Polyline | null>(null)
  const initializedRef = useRef(false)
  const lastDirectionsKeyRef = useRef<string>('')

  const [mapReady, setMapReady] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null)

  // ── Custom pin builders ────────────────────────────────────────────────

  const createActivePin = useCallback(() => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(99,102,241,0.25);animation:mapPulse 2s ease-in-out infinite;"></div>
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#6366f1);border:3px solid white;box-shadow:0 0 16px rgba(99,102,241,0.6),0 2px 8px rgba(0,0,0,0.3);z-index:2;"></div>
      </div>
    `
    return wrapper
  }, [])

  const createNumberedPin = useCallback((num: number) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div style="width:24px;height:24px;border-radius:50%;background:#27272a;border:2px solid #52525b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#a1a1aa;font-family:system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4);">${num}</div>
    `
    return wrapper
  }, [])

  const createUserPin = useCallback(() => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,0.2);animation:mapPulse 2.5s ease-in-out infinite;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 0 12px rgba(16,185,129,0.5);z-index:2;"></div>
      </div>
    `
    return wrapper
  }, [])

  // ── Initialize map ─────────────────────────────────────────────────────

  useEffect(() => {
    if (initializedRef.current || !mapContainerRef.current || !API_KEY) return
    initializedRef.current = true

    if (!optionsSet) {
      setOptions({ key: API_KEY, v: 'weekly' })
      optionsSet = true
    }

    importLibrary('maps').then((mapsLib: google.maps.MapsLibrary) => {
      if (!mapContainerRef.current) return
      mapRef.current = new mapsLib.Map(mapContainerRef.current, {
        center: userLocation || { lat: 19.076, lng: 72.877 },
        zoom: 14,
        mapId: MAP_ID || undefined,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        styles: MAP_ID ? undefined : DARK_MAP_STYLES,
        backgroundColor: '#1a1a2e',
      })
      setMapReady(true)
    })
  }, [])

  // ── Update markers & bounds ────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    markersRef.current.forEach(m => (m.map = null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    const addMarker = async (
      position: { lat: number; lng: number },
      content: HTMLElement,
      zIndex: number
    ) => {
      const { AdvancedMarkerElement } = (await importLibrary('marker')) as google.maps.MarkerLibrary
      const marker = new AdvancedMarkerElement({ map, position, content, zIndex })
      markersRef.current.push(marker)
    }

    if (userLocation && userLocation.lat !== 0) {
      addMarker(userLocation, createUserPin(), 10)
      bounds.extend(userLocation)
      hasPoints = true
    }

    if (activeTarget && activeTarget.lat !== 0) {
      addMarker({ lat: activeTarget.lat, lng: activeTarget.lng }, createActivePin(), 20)
      bounds.extend({ lat: activeTarget.lat, lng: activeTarget.lng })
      hasPoints = true
    }

    remainingStops.forEach((stop, i) => {
      if (stop.id === activeTarget?.id || stop.lat === 0) return
      addMarker({ lat: stop.lat, lng: stop.lng }, createNumberedPin(stop.index + 1), 5)
      if (i < 2) {
        bounds.extend({ lat: stop.lat, lng: stop.lng })
        hasPoints = true
      }
    })

    // Only fit bounds on first map readiness or when activeTarget changes
    if (hasPoints && !lastDirectionsKeyRef.current) {
      map.fitBounds(bounds, { top: 30, right: 40, bottom: 30, left: 40 })
    }
  }, [mapReady, activeTarget?.id, remainingStops.length, createActivePin, createNumberedPin, createUserPin])

  // ── Directions API: real driving route for the active leg ──────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !userLocation || userLocation.lat === 0 || !activeTarget || activeTarget.lat === 0) {
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null)
      setRouteInfo(null)
      lastDirectionsKeyRef.current = '' // CLEAR CACHE
      return
    }

    // Use a persistent DirectionsRenderer
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: phase === 'COLLECTING' ? '#f59e0b' : '#6366f1',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        },
      })
    } else {
      directionsRendererRef.current.setMap(map)
      directionsRendererRef.current.setOptions({
        polylineOptions: {
          strokeColor: phase === 'COLLECTING' ? '#f59e0b' : '#6366f1',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        }
      })
    }

    // Only re-fetch if destiny/origin changed enough to matter
    const newKey = `${phase}-${activeTarget.id}`
    const locKey = userLocation.lat.toFixed(4) + userLocation.lng.toFixed(4)
    if (newKey === lastDirectionsKeyRef.current?.split('|')[0] && locKey === lastDirectionsKeyRef.current?.split('|')[1]) return
    lastDirectionsKeyRef.current = `${newKey}|${locKey}`

    const directionsService = new google.maps.DirectionsService()
    directionsService.route(
      {
        origin: userLocation,
        destination: { lat: activeTarget.lat, lng: activeTarget.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result)
          const leg = result.routes[0]?.legs[0]
          if (leg) {
            setRouteInfo({
              duration: leg.duration?.text || '',
              distance: leg.distance?.text || '',
            })
          }
        } else {
          console.warn('Directions request failed:', status)
          setRouteInfo(null)
          lastDirectionsKeyRef.current = ''
        }
      }
    )
  }, [mapReady, activeTarget?.id, activeTarget?.lat, activeTarget?.lng, userLocation?.lat, userLocation?.lng, phase])

  // ── Dashed polyline for remaining stops (lightweight overview) ─────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (remainingPolyRef.current) {
      remainingPolyRef.current.setMap(null)
      remainingPolyRef.current = null
    }

    const pathCoords: google.maps.LatLngLiteral[] = []
    if (activeTarget && activeTarget.lat !== 0) {
      pathCoords.push({ lat: activeTarget.lat, lng: activeTarget.lng })
    }
    remainingStops.forEach((s) => {
      if (s.lat !== 0 && s.id !== activeTarget?.id) {
        pathCoords.push({ lat: s.lat, lng: s.lng })
      }
    })

    if (pathCoords.length > 1) {
      const poly = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeOpacity: 0,
        strokeWeight: 3,
        map,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.3,
            strokeColor: phase === 'COLLECTING' ? '#f59e0b' : '#6366f1',
            scale: 3,
          },
          offset: '0',
          repeat: '14px',
        }],
      })
      remainingPolyRef.current = poly
    }
  }, [mapReady, activeTarget?.id, remainingStops.length, phase])

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Phase indicator */}
      {/* <div className="absolute top-4 left-4 z-10">
        <div className={`
          px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest
          backdrop-blur-md border
          ${phase === 'COLLECTING'
            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
            : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
          }
        `}>
          {phase === 'COLLECTING' ? '📦 Collecting' : '🚀 Delivering'}
        </div>
      </div> */}

      {/* ETA / Distance chip */}
      {routeInfo && (
        <div className="absolute top-6 right-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-zinc-900/70 border border-white/10">
            <span className="text-[10px] font-black text-white">{routeInfo.duration}</span>
            <span className="w-px h-3 bg-white/20" />
            <span className="text-[10px] font-bold text-zinc-400">{routeInfo.distance}</span>
          </div>
        </div>
      )}

      {/* Fallback when no API key */}
      {!API_KEY && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-20">
          <div className="text-zinc-500 text-sm font-mono text-center px-6">
            <p className="text-lg font-bold text-zinc-400 mb-2">Map Preview</p>
            <p>Add <code className="text-indigo-400">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
            <p>to your <code className="text-indigo-400">.env</code> file to enable the live map.</p>
          </div>
        </div>
      )}
    </div>
  )
}
