'use client'

import { useCallback, useRef, useState } from 'react'
import {
  LoadScript,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #18181b, #0f0f12)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <Package className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">New Order</h2>
              <p className="text-xs text-zinc-500">Fill in sender &amp; receiver details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <LoadScript googleMapsApiKey={MAPS_API_KEY} libraries={LIBRARIES}>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Two-column grid — collapses to single column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── SENDER ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-amber-300"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}
                  >
                    S
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Sender</span>
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

                <Field label="Pickup Address" icon={<MapPin className="w-4 h-4 text-amber-400" />}>
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
              <div className="hidden md:block absolute left-1/2 top-52 bottom-6 w-px bg-white/5" />

              {/* ── RECEIVER ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-indigo-300"
                    style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    R
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Receiver</span>
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

                <Field label="Drop-off Address" icon={<MapPin className="w-4 h-4 text-indigo-400" />}>
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
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-300"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <X className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              id="save-order-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: saving
                  ? 'rgba(99,102,241,0.5)'
                  : 'linear-gradient(135deg,#818cf8,#6366f1)',
                boxShadow: saving ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
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
        </LoadScript>
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
      <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-all ' +
  'bg-zinc-800/60 border border-zinc-700/50 ' +
  'focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 ' +
  'hover:border-zinc-600'
