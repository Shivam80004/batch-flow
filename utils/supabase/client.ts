import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Resilient fetch wrapper.
 *
 * Supabase's auth client fires `_recoverAndRefresh` on every page load to
 * silently renew the JWT. If the network is momentarily unavailable (dev-server
 * restart, brief offline, DNS hiccup) this generates a `TypeError: Failed to
 * fetch` flood in the console even though the app continues working fine.
 *
 * This wrapper catches those transient token-refresh errors and rethrows them
 * as a well-labelled warning instead of a noisy unhandled rejection, while
 * leaving all other Supabase network calls completely transparent.
 */
function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const nativeFetch = (typeof window !== 'undefined' ? window.fetch : fetch).bind(
    typeof window !== 'undefined' ? window : globalThis,
  )
  return nativeFetch(input, init).catch((err: unknown) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    // Only downgrade background token-refresh errors — NOT signInWithPassword or other auth calls.
    // signInWithPassword  → /auth/v1/token?grant_type=password  (must surface to UI)
    // refresh token call  → /auth/v1/token?grant_type=refresh_token  (safe to silence)
    const isRefreshTokenCall = url.includes('grant_type=refresh_token')
    if (isRefreshTokenCall) {
      // Downgrade to a warning — the SDK handles this gracefully by itself
      console.warn('[supabase] Token refresh failed (network unavailable — will retry):', (err as Error).message)
    }
    return Promise.reject(err)
  })
}

/**
 * Single shared Supabase client.
 *
 * realtime.params.eventsPerSecond  — lets the channel receive bursts without
 *   being dropped by the server-side rate limiter (default is 10/s which is
 *   too low when multiple tables fire updates at once).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
  global: {
    fetch: resilientFetch,
  },
})
