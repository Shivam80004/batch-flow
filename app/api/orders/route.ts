import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Instantiate a localized client bound to the incoming request's user token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      sender_name,
      sender_phone,
      pickup_address,
      pickupLat,
      pickupLng,
      receiver_name,
      receiver_phone,
      drop_address,
      dropLat,
      dropLng,
    } = await request.json()

    if (
      !sender_name || !sender_phone || !pickup_address ||
      pickupLat === undefined || pickupLng === undefined ||
      !receiver_name || !receiver_phone || !drop_address ||
      dropLat === undefined || dropLng === undefined
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the tenant specific to this authenticated user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
    }

    const verifiedTenantId = tenant.id

    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: verifiedTenantId,
        sender_name,
        sender_phone,
        pickup_address,
        pickup_pt: `POINT(${pickupLng} ${pickupLat})`,
        receiver_name,
        receiver_phone,
        drop_address,
        drop_pt: `POINT(${dropLng} ${dropLat})`,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
