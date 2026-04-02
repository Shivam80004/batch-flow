import { NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/client'

export async function POST(request: Request) {
  try {
    const { tenantId, pickupLat, pickupLng, dropLat, dropLng } = await request.json()

    if (!tenantId || pickupLat === undefined || pickupLng === undefined || dropLat === undefined || dropLng === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        pickup_pt: `POINT(${pickupLng} ${pickupLat})`,
        drop_pt: `POINT(${dropLng} ${dropLat})`
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
