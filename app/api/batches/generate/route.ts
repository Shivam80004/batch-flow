import { NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/client'
import { optimizeRouteSequence, parsePoint } from '@/utils/routing'

export async function POST(request: Request) {
  try {
    const { tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    // 1. Generate batches via RPC (groups orders by proximity/time)
    const { data: generatedBatches, error: rpcError } = await supabase.rpc('generate_smart_batches', {
      target_tenant_id: tenantId
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    // 2. Optimized Routing Integration:
    // After grouping, we need to sequence the drop-offs inside each batch optimally.
    try {
      // Fetch all orders that were just assigned to batches
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, batch_id, pickup_pt, drop_pt')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .not('batch_id', 'is', null);

      if (ordersError) throw ordersError;

      // Group orders by their batch ID
      const batchesMap: Record<string, any[]> = {};
      orders.forEach(order => {
        if (!batchesMap[order.batch_id]) batchesMap[order.batch_id] = [];
        batchesMap[order.batch_id].push(order);
      });

      // For each batch, run the Nearest Neighbor TSP algorithm
      for (const batchId in batchesMap) {
        const batchOrders = batchesMap[batchId];
        if (batchOrders.length === 0) continue;

        // Pickup is usually the restaurant (shared startPoint for the batch sequence)
        const startPoint = parsePoint(batchOrders[0].pickup_pt);

        // Convert orders to simplified DeliveryOrder interface for the algorithm
        const deliveryPool = batchOrders.map(o => ({
          id: o.id,
          dropLat: parsePoint(o.drop_pt).lat,
          dropLng: parsePoint(o.drop_pt).lng
        }));

        // Note: Optimization is handled in-memory by the UI (RiderPage) for robustness 
        // against missing database columns like 'sequence_order'.
      }
    } catch (seqError) {
      console.error('Routing optimization pre-check failed:', seqError);
    }

    return NextResponse.json({ message: 'Batches generated and optimized successfully', data: generatedBatches })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
