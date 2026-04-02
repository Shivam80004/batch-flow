/**
 * Logistics Engine — Phase B: Pivot Math Utility
 *
 * This module contains the core distance calculation and the Nearest Neighbor
 * algorithm used to re-sequence deliveries at the "pivot" moment — when the
 * rider finishes all pickups and switches to delivering.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Coordinate {
  lat: number
  lng: number
}

export interface BatchOrder {
  id: string
  pickup_lat: number
  pickup_lng: number
  drop_lat: number
  drop_lng: number
  pickup_address_text?: string
  dropoff_address_text?: string
  status: 'pending' | 'batched' | 'picked_up' | 'delivering' | 'delivered'
}

// ─── Haversine Distance ──────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two coordinates using the
 * Haversine formula. Returns kilometers.
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6371 // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const sinHalfLat = Math.sin(dLat / 2)
  const sinHalfLng = Math.sin(dLng / 2)

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ─── Nearest-Neighbor Optimizer ──────────────────────────────────────────────

/**
 * Given the rider's current GPS position (at the moment of the last pickup),
 * re-sorts `orders` using the Nearest-Neighbor heuristic:
 *   1. Start at `currentPos`.
 *   2. Pick the unvisited drop-off closest to the current position.
 *   3. Move there, repeat until every order is sequenced.
 *
 * Returns a **new array** — the original is never mutated.
 */
export function calculateOptimizedSequence(
  currentPos: Coordinate,
  orders: BatchOrder[]
): BatchOrder[] {
  if (!orders || orders.length === 0) return []

  const sorted: BatchOrder[] = []
  const pool = [...orders]
  let cursor: Coordinate = { ...currentPos }

  while (pool.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity

    for (let i = 0; i < pool.length; i++) {
      const d = haversineDistance(cursor, {
        lat: pool[i].drop_lat,
        lng: pool[i].drop_lng,
      })
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }

    const [next] = pool.splice(bestIdx, 1)
    sorted.push(next)
    cursor = { lat: next.drop_lat, lng: next.drop_lng }
  }

  return sorted
}

/**
 * Estimates the accumulated distance for an array of stops starting from
 * a given position. Useful for the UI distance badge.
 */
export function estimateTotalRouteDistance(
  start: Coordinate,
  stops: BatchOrder[]
): number {
  let total = 0
  let cursor = start
  for (const s of stops) {
    const dest: Coordinate = { lat: s.drop_lat, lng: s.drop_lng }
    total += haversineDistance(cursor, dest)
    cursor = dest
  }
  return total
}
