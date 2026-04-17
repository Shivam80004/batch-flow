'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Loader2, Bike } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

export default function RiderRegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      const user = authData.user
      if (!user) throw new Error('No user returned from sign up')

      // 2. Create profile with role: rider
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: user.id, full_name: fullName, role: 'rider' })

      if (profileError) throw profileError

      router.push('/rider-home')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      {/* Ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vh] bg-radium-green/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vh] bg-emerald-600/8 blur-[150px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-[32px] p-10 transition-all duration-500 text-white">

          {/* Header */}
          <div className="mb-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-radium-green/10 border border-radium-green/20 rounded-2xl flex items-center justify-center mb-6 glow-radium transform transition duration-500 hover:rotate-12">
              <Bike className="w-7 h-7 text-radium-green" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Rider Sign Up</h1>
            <p className="text-zinc-400 text-sm font-medium tracking-wide">
              Create your delivery account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-radium-green transition-colors pointer-events-none" />
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-radium-green transition-colors pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="rider@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-radium-green transition-colors pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative mt-2 group overflow-hidden rounded-[20px] bg-radium-green px-4 py-4 text-sm font-bold text-zinc-950 transition-all hover:bg-radium-green-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_24px_rgba(212,255,0,0.2)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Creating account…</>
                ) : (
                  'Create Rider Account'
                )}
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-xs font-medium text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-radium-green hover:text-radium-green-hover transition-colors ml-1">
              Sign In
            </Link>
          </div>
          <div className="mt-4 text-center text-xs font-medium text-zinc-600">
            Business owner?{' '}
            <Link href="/register/business" className="text-zinc-400 hover:text-white transition-colors ml-1">
              Register a company
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
