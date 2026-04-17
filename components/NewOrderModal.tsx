'use client'

import { useCallback, useRef, useState } from 'react'
import {
  useJsApiLoader,
  Autocomplete,
  Libraries,
} from '@react-google-maps/api'
import { X, MapPin, User, Phone, Package, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoordPt {
  lat: number
  lng: number
}

interface FormState {
  sender_name: string
  sender_phone: string
  pickup_address: string
  pickup_pt: CoordPt | null

  receiver_name: string
  receiver_phone: string
  drop_address: string
  drop_pt: CoordPt | null
}

interface NewOrderModalProps {
  onClose: () => void
  onSaved: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: Libraries = ['places']

const EMPTY_FORM: FormState = {
  sender_name: '',
  sender_phone: '',
  pickup_address: '',
  pickup_pt: null,
  receiver_name: '',
  receiver_phone: '',
  drop_address: '',
  drop_pt: null,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewOrderModal({ onClose, onSaved }: NewOrderModalProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete refs – needed to call .getPlace() imperatively
  const pickupAutoRef = useRef<google.maps.places.Autocomplete | null>(null)
  const dropAutoRef = useRef<google.maps.places.Autocomplete | null>(null)

  // ── Field helpers ──────────────────────────────────────────────────────

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  // ── Autocomplete callbacks ─────────────────────────────────────────────

  const onPickupLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    pickupAutoRef.current = ac
  }, [])

  const onDropLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    dropAutoRef.current = ac
  }, [])

  const onPickupPlaceChanged = useCallback(() => {
    const place = pickupAutoRef.current?.getPlace()
    if (!place) return
    const lat = place.geometry?.location?.lat() ?? 0
    const lng = place.geometry?.location?.lng() ?? 0
    setForm((prev) => ({
      ...prev,
      pickup_address: place.formatted_address || prev.pickup_address,
      pickup_pt: { lat, lng },
    }))
  }, [])

  const onDropPlaceChanged = useCallback(() => {
    const place = dropAutoRef.current?.getPlace()
    if (!place) return
    const lat = place.geometry?.location?.lat() ?? 0
    const lng = place.geometry?.location?.lng() ?? 0
    setForm((prev) => ({
      ...prev,
      drop_address: place.formatted_address || prev.drop_address,
      drop_pt: { lat, lng },
    }))
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setError(null)

    if (!form.sender_name.trim()) return setError('Sender name is required.')
    if (!form.sender_phone.trim()) return setError('Sender phone is required.')
    if (!form.pickup_pt) return setError('Please select a pickup address from the dropdown.')
    if (!form.receiver_name.trim()) return setError('Receiver name is required.')
    if (!form.receiver_phone.trim()) return setError('Receiver phone is required.')
    if (!form.drop_pt) return setError('Please select a drop-off address from the dropdown.')

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sender_name: form.sender_name.trim(),
          sender_phone: form.sender_phone.trim(),
          pickup_address: form.pickup_address,
          pickupLat: form.pickup_pt.lat,
          pickupLng: form.pickup_pt.lng,
          receiver_name: form.receiver_name.trim(),
          receiver_phone: form.receiver_phone.trim(),
          drop_address: form.drop_address,
          dropLat: form.drop_pt.lat,
          dropLng: form.drop_pt.lng,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save order')

      setForm(EMPTY_FORM)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-3xl border border-white/5"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-radium-green/5 to-transparent opacity-50 pointer-events-none" />

        {/* Header */}
        <div
          className="relative flex items-center justify-between px-8 py-6 border-b border-white/5 bg-zinc-900/50"
        >
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-2xl bg-radium-green/10 border border-radium-green/20 relative"
            >
              <div className="absolute inset-0 bg-radium-green/20 blur-xl rounded-full" />
              <Package className="relative w-6 h-6 text-radium-green" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">New Order</h2>
              <p className="text-sm text-zinc-400 font-medium tracking-wide">Fill in sender & receiver details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors bg-zinc-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoaded ? (<>
          <div className="relative p-8 space-y-8 max-h-[75vh] overflow-y-auto">
            {/* Two-column grid — collapses to single column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">

              {/* Vertical divider (desktop only) */}
              <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-white/5" />

              {/* ── SENDER ── */}
              <section className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-black text-amber-500 bg-amber-500/10 border border-amber-500/20"
                  >
                    S
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest text-amber-500">Sender</span>
                </div>

                <Field label="Name" icon={<User className="w-4 h-4" />}>
                  <input
                    id="sender_name"
                    type="text"
                    placeholder="e.g. Arjun Sharma"
                    value={form.sender_name}
                    onChange={setField('sender_name')}
                    className={inputClass}
                  />
                </Field>

                <Field label="Phone" icon={<Phone className="w-4 h-4" />}>
                  <input
                    id="sender_phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.sender_phone}
                    onChange={setField('sender_phone')}
                    className={inputClass}
                  />
                </Field>

                <Field label="Pickup Address" icon={<MapPin className="w-4 h-4 text-amber-500" />}>
                  <Autocomplete onLoad={onPickupLoad} onPlaceChanged={onPickupPlaceChanged}>
                    <input
                      id="pickup_address"
                      type="text"
                      placeholder="Search pickup location…"
                      value={form.pickup_address}
                      onChange={setField('pickup_address')}
                      className={inputClass}
                    />
                  </Autocomplete>
                  {form.pickup_pt && (
                    <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {form.pickup_pt.lat.toFixed(5)}, {form.pickup_pt.lng.toFixed(5)}
                    </p>
                  )}
                </Field>
              </section>

              {/* ── RECEIVER ── */}
              <section className="space-y-5">
                <div className="flex items-center gap-3 mb-4 md:pl-4">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-black text-radium-green bg-radium-green/10 border border-radium-green/20"
                  >
                    R
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest text-radium-green">Receiver</span>
                </div>

                <Field label="Name" icon={<User className="w-4 h-4" />}>
                  <input
                    id="receiver_name"
                    type="text"
                    placeholder="e.g. Priya Mehta"
                    value={form.receiver_name}
                    onChange={setField('receiver_name')}
                    className={inputClass}
                  />
                </Field>

                <Field label="Phone" icon={<Phone className="w-4 h-4" />}>
                  <input
                    id="receiver_phone"
                    type="tel"
                    placeholder="+91 91234 56789"
                    value={form.receiver_phone}
                    onChange={setField('receiver_phone')}
                    className={inputClass}
                  />
                </Field>

                <Field label="Drop-off Address" icon={<MapPin className="w-4 h-4 text-radium-green" />}>
                  <Autocomplete onLoad={onDropLoad} onPlaceChanged={onDropPlaceChanged}>
                    <input
                      id="drop_address"
                      type="text"
                      placeholder="Search drop-off location…"
                      value={form.drop_address}
                      onChange={setField('drop_address')}
                      className={inputClass}
                    />
                  </Autocomplete>
                  {form.drop_pt && (
                    <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {form.drop_pt.lat.toFixed(5)}, {form.drop_pt.lng.toFixed(5)}
                    </p>
                  )}
                </Field>
              </section>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-4 px-5 py-4 rounded-[16px] text-sm text-red-400 bg-red-500/10 border border-red-500/20 shadow-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/5 blur-xl rounded-full" />
                <X className="w-5 h-5 mt-0.5 shrink-0 text-red-500 relative z-10" />
                <span className="relative z-10 font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-4 px-8 py-6 bg-zinc-900/50 border-t border-white/5 relative z-10"
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3.5 rounded-[16px] text-sm font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              id="save-order-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-3 px-8 py-3.5 rounded-[16px] text-sm font-bold text-zinc-950 transition-all active:scale-95 disabled:opacity-60 bg-radium-green hover:bg-radium-green-hover relative overflow-hidden group"
              style={{
                boxShadow: saving ? 'none' : '0 0 20px rgba(212,255,0,0.2)',
              }}
            >
              <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Save Order
                  </>
                )}
              </div>
            </button>
          </div>
        </>) : null}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label,
  icon,
  children,
  className = ""
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-2 relative group ${className}`}>
      <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 transition-colors group-hover:text-zinc-300">
        <span className="text-zinc-500 group-focus-within:text-radium-green transition-colors">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-5 py-3.5 rounded-[16px] text-sm text-white placeholder-zinc-500 font-medium outline-none transition-all ' +
  'bg-zinc-950/80 border border-white/10 ' +
  'focus:border-radium-green focus:bg-zinc-900 ' +
  'hover:border-white/20'
