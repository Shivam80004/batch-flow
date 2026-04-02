/**
 * Types for spatial routing
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface DeliveryOrder {
  id: string;
  dropLat: number;
  dropLng: number;
}

/**
 * Parses a PostGIS string-formatted point (e.g., "POINT(lng lat)") into a Coordinate object.
 * Note: PostGIS usually stores as (longitude, latitude).
 * 
 * @param pointStr - The raw point string from Supabase
 * @returns A Coordinate object
 */
export function parsePoint(pointStr: string): Coordinate {
  // 1. Handle standard PostGIS string format: "POINT(lng lat)"
  const match = pointStr.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  if (match) {
    return {
      lng: parseFloat(match[1]),
      lat: parseFloat(match[2]),
    };
  }

  // 2. Handle EWKB hex string format (Supabase/PostGIS default binary output)
  // Example: 0101000020E6100000287E8CB96B35524079E9263108EC3240
  const isHex = /^[0-9A-Fa-f]+$/.test(pointStr);
  if (isHex && pointStr.length >= 50) {
    try {
      const isLittleEndian = pointStr.substring(0, 2) === '01';
      
      // Hex to Float64 parser for EWKB (Little Endian)
      const hexToDouble = (hexPart: string) => {
        const bytes = new Uint8Array(
          hexPart.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );
        const dv = new DataView(bytes.buffer);
        return dv.getFloat64(0, isLittleEndian);
      };

      // In EWKB for a POINT with SRID (01 01000020 E6100000 ...):
      // Bytes 0-8: Header and SRID
      // Bytes 9-16: Longitude (Double)
      // Bytes 17-24: Latitude (Double)
      // Hex position: 0-17 is header, 18-33 is lng, 34-49 is lat
      const lng = hexToDouble(pointStr.substring(18, 34));
      const lat = hexToDouble(pointStr.substring(34, 50));

      return { lng, lat };
    } catch (err) {
      throw new Error(`Failed to parse EWKB hex: ${pointStr}`);
    }
  }

  throw new Error(`Invalid point format: ${pointStr}`);
}

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 * This formula accounts for the curvature of the earth.
 * 
 * @param coord1 - The starting coordinate
 * @param coord2 - The destination coordinate
 * @returns The distance in kilometers
 */
export function calculateHaversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
      Math.cos(coord2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Optimizes the delivery route based on a basic Traveling Salesperson Problem (TSP) 
 * using the 'Nearest Neighbor' heuristic.
 * 
 * The algorithm starts from a fixed point (e.g., rider pickup location) and repeatedly 
 * visits the nearest unvisited drop-off location until all orders are sequenced.
 * 
 * @param startPoint - The rider's starting position (usually the last pickup location)
 * @param orders - The pool of delivery orders to sequence
 * @returns An array of orders sorted by the optimized delivery sequence
 */
export function optimizeRouteSequence(
  startPoint: Coordinate,
  orders: DeliveryOrder[]
): DeliveryOrder[] {
  // Handle edge case: empty array
  if (!orders || orders.length === 0) {
    return [];
  }

  const sortedRoute: DeliveryOrder[] = [];
  const unvisitedOrders = [...orders]; // Create a pool to avoid mutating the original array
  let currentLocation: Coordinate = startPoint;

  while (unvisitedOrders.length > 0) {
    let closestIndex = -1;
    let shortestDistance = Infinity;

    // Search for the closest unvisited location
    for (let i = 0; i < unvisitedOrders.length; i++) {
        const order = unvisitedOrders[i];
        const distance = calculateHaversineDistance(currentLocation, {
            lat: order.dropLat,
            lng: order.dropLng,
        });

        if (distance < shortestDistance) {
            shortestDistance = distance;
            closestIndex = i;
        }
    }

    if (closestIndex !== -1) {
        // Remove the closest order from unvisited pool
        const [nextOrder] = unvisitedOrders.splice(closestIndex, 1);
        
        // Add to the sequence
        sortedRoute.push(nextOrder);
        
        // Update current location to the last drop-off point
        currentLocation = {
            lat: nextOrder.dropLat,
            lng: nextOrder.dropLng,
        };
    } else {
        // Fallback for safety (should not be reached with real coordinates)
        break;
    }
  }

  return sortedRoute;
}
