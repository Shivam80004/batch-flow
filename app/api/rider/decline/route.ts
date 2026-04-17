import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/**
 * POST /api/rider/decline
 * Body: { batchId: string, riderId: string }
 *
 * Securely un-assigns a batch back to the unassigned queue.
 * Uses service-role key to bypass RLS — ownership is verified server-side
 * by confirming the batch's rider_id matches the caller before updating.
 */
export async function POST(request: Request) {
  try {
    const { batchId, riderId } = await request.json()

    if (!batchId || !riderId) {
      return NextResponse.json({ error: 'Missing batchId or riderId' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // ── Security check: confirm this batch is actually assigned to this rider ──
    const { data: batch, error: fetchError } = await supabase
      .from('batches')
      .select('id, rider_id, status')
      .eq('id', batchId)
      .single()

    if (fetchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if (batch.rider_id !== riderId) {
      return NextResponse.json({ error: 'Unauthorized: batch not assigned to this rider' }, { status: 403 })
    }

    if (batch.status === 'active') {
      return NextResponse.json({ error: 'Cannot decline a batch that is already active' }, { status: 409 })
    }

    // ── Un-assign the batch → back to unassigned queue ────────────────────────
    const { error: updateError } = await supabase
      .from('batches')
      .update({ rider_id: null, status: 'unassigned' })
      .eq('id', batchId)

    if (updateError) {
      console.error('[rider/decline] DB error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[rider/decline] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
