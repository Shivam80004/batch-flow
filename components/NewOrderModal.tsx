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
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: 'rgba(212,255,0,0.15)', border: '1px solid rgba(212,255,0,0.25)' }}
            >
              <Package className="w-5 h-5 text-radium-green" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">New Order</h2>
              <p className="text-xs text-zinc-500 font-medium">Fill in sender &amp; receiver details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-all shadow-sm"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoaded ? (<>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Two-column grid — collapses to single column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── SENDER ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-amber-600 shadow-inner"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}
                  >
                    S
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Sender</span>
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

              {/* Vertical divider (desktop only) */}
              <div className="hidden md:block absolute left-1/2 top-52 bottom-6 w-px bg-zinc-100" />

              {/* ── RECEIVER ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-radium-green shadow-inner"
                    style={{ background: 'rgba(212,255,0,0.15)', border: '1px solid rgba(212,255,0,0.3)' }}
                  >
                    R
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-900">Receiver</span>
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
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200 shadow-sm"
              >
                <X className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50"
            style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 rounded-[16px] text-sm font-bold text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 shadow-sm hover:bg-zinc-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              id="save-order-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-[16px] text-sm font-bold text-zinc-950 transition-all active:scale-95 disabled:opacity-60 bg-radium-green hover:bg-radium-green-hover"
              style={{
                boxShadow: saving ? 'none' : '0 4px 14px rgba(212,255,0,0.3)',
              }}
            >
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
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-4 py-3 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 font-medium outline-none transition-all shadow-inner ' +
  'bg-zinc-50 border border-zinc-200 ' +
  'focus:border-radium-green focus:ring-4 focus:ring-radium-green/20 ' +
  'hover:border-zinc-300'
