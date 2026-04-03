import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePoint } from '@/utils/routing'

// Server-side admin client — bypasses RLS, safe for API routes only
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Generate batches via RPC (groups orders by proximity/time)
    const { data: generatedBatches, error: rpcError } = await supabase.rpc('generate_smart_batches', {
      target_tenant_id: tenantId
    })

    if (rpcError) {
      console.error('[generate] RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message, details: rpcError }, { status: 400 })
    }

    // 2. Fetch orders assigned to newly created batches for reference
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, batch_id, pickup_pt, drop_pt')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .not('batch_id', 'is', null)

      if (ordersError) throw ordersError

      // Group orders by batch ID
      const batchesMap: Record<string, any[]> = {}
      orders.forEach((order: any) => {
        if (!batchesMap[order.batch_id]) batchesMap[order.batch_id] = []
        batchesMap[order.batch_id].push(order)
      })

      // Note: Optimization is handled in-memory by the RiderPage for robustness.
      for (const batchId in batchesMap) {
        const batchOrders = batchesMap[batchId]
        if (batchOrders.length === 0) continue
        // Route sequencing is done client-side via calculateOptimizedSequence()
      }
    } catch (seqError) {
      console.error('[generate] Post-batch fetch failed:', seqError)
    }

    return NextResponse.json({ message: 'Batches generated successfully', data: generatedBatches })
  } catch (error) {
    console.error('[generate] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
