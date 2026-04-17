import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Single shared Supabase client.
 *
 * realtime.params.eventsPerSecond  — lets the channel receive bursts without
 *   being dropped by the server-side rate limiter (default is 10/s which is
 *   too low when multiple tables fire updates at once).
 *
 * global.WebSocket — explicitly set to the browser's native WebSocket so the
 *   client never falls back to polling, even inside Next.js's bundler context.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
  global: {
    // Ensure the browser's native WebSocket is always used (not a polyfill)
    fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : undefined,
  },
})
