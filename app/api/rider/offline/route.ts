import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client — bypasses RLS, safe for server-only routes
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/**
 * POST /api/rider/offline
 * Body: { riderId: string }
 *
 * Sets is_online = false for the given rider.
 * Called via navigator.sendBeacon on tab close / logout / session expiry.
 * Uses service-role key so it works even after the user's JWT has expired.
 */
export async function POST(request: Request) {
  try {
    let riderId: string | null = null

    // sendBeacon sends as text/plain — support both JSON and plain text
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      riderId = body?.riderId ?? null
    } else {
      // sendBeacon sends FormData or plain text
      const text = await request.text()
      try {
        riderId = JSON.parse(text)?.riderId ?? null
      } catch {
        riderId = null
      }
    }

    if (!riderId) {
      return NextResponse.json({ error: 'Missing riderId' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase
      .from('profiles')
      .update({ is_online: false })
      .eq('id', riderId)

    if (error) {
      console.error('[rider/offline] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[rider/offline] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
