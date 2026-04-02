import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const TEST_TENANT_ID = 'be0d85ef-54cd-4b34-8c25-8bc4780604d8'

async function debug() {
  console.log('--- DETAILED DEBUGGING ---')

  const { data: orders, error: oError } = await supabase
    .from('orders')
    .select('id, status, batch_id')
    .eq('tenant_id', TEST_TENANT_ID)
  
  if (oError) {
    console.error('Orders Error:', oError)
    return
  }

  console.log('All Orders for Tenant:')
  orders.forEach(o => {
    console.log(`ID: ${o.id.slice(0,8)}... | Status: ${o.status} | BatchID: ${o.batch_id || 'NULL'}`)
  })

  const { data: batches, error: bError } = await supabase
    .from('batches')
    .select('id, status')
    .eq('tenant_id', TEST_TENANT_ID)
  
  if (bError) console.error('Batches Error:', bError)
  else {
    console.log('\nBatches:')
    batches.forEach(b => {
      const ordersInBatch = orders.filter(o => o.batch_id === b.id)
      console.log(`Batch: ${b.id.slice(0,8)}... | Status: ${b.status} | Orders Count: ${ordersInBatch.length}`)
    })
  }
}

debug()
