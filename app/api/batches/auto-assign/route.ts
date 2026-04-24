import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side admin client — bypasses RLS, safe for API routes only
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/**
 * POST /api/batches/auto-assign
 * Body: { batchId: string }
 *
 * 1. Calls the Postgres `find_nearest_rider(batch_id)` function which uses
 *    ST_Distance to find the closest idle online rider to the batch's first
 *    order pickup point.
 * 2. Assigns that rider to the batch (status → 'assigned').
 * 3. Returns { riderId, riderName, distanceKm }
 */
export async function POST(request: Request) {
  try {
    const { batchId } = await request.json()

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // ── Step 1: Verify the batch is still unassigned ────────────────────────
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, status, rider_id')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if (batch.status !== 'unassigned') {
      return NextResponse.json(
        { error: `Batch is already ${batch.status}` },
        { status: 409 }
      )
    }

    // ── Step 2: Find nearest available rider via PostGIS ───────────────────
    const { data: riders, error: rpcError } = await supabase.rpc('find_nearest_rider', {
      p_batch_id: batchId,
    })

    if (rpcError) {
      console.error('[auto-assign] RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!riders || riders.length === 0) {
      return NextResponse.json(
        { error: 'No available riders found near the pickup point' },
        { status: 404 }
      )
    }

    const nearest = riders[0]
    const distanceKm = (nearest.distance_m / 1000).toFixed(1)

    // ── Step 3: Assign the rider to the batch ─────────────────────────────
    const { error: assignError } = await supabase
      .from('batches')
      .update({ rider_id: nearest.rider_id, status: 'assigned' })
      .eq('id', batchId)
      .eq('status', 'unassigned') // optimistic-lock: prevent double-assign

    if (assignError) {
      console.error('[auto-assign] Assign error:', assignError)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      riderId: nearest.rider_id,
      riderName: nearest.rider_name,
      distanceKm,
    })
  } catch (err) {
    console.error('[auto-assign] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
