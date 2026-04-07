'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2, Package } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const checkSession = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                router.replace('/dashboard')
            } else {
                setChecking(false)
            }
        }
        checkSession()
    }, [router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) {
                if (signInError.message.toLowerCase().includes('email not confirmed')) {
                    setError('Please check your email to confirm your account before signing in.')
                } else if (signInError.message.toLowerCase().includes('invalid login credentials')) {
                    setError('Invalid email or password. Please try again.')
                } else {
                    setError(signInError.message)
                }
                setLoading(false)
            } else {
                router.refresh()
                router.push('/dashboard')
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.')
            setLoading(false)
        }
    }

    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50">
                <Loader2 className="w-8 h-8 animate-spin text-radium-green" />
            </div>
        )
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">

            <div className="relative z-10 w-full max-w-[420px]">
                {/* Glass Card */}
                <div className="rounded-[32px] p-10 transform transition-all hover:scale-[1.01] duration-500 shadow-[0_16px_40px_rgba(0,0,0,0.15)] text-white">

                    {/* Header */}
                    <div className="mb-10 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-radium-green/10 border border-radium-green/20 rounded-2xl flex items-center justify-center mb-6 glow-radium transform transition duration-500 hover:rotate-12">
                            <Package className="w-7 h-7 text-radium-green" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            Logistics Platform
                        </h1>
                        <p className="text-zinc-400 text-sm font-medium tracking-wide">
                            Enter your credentials to continue
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 backdrop-blur-md">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Email Field */}
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
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
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
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative mt-4 group overflow-hidden rounded-[20px] bg-radium-green px-4 py-4 text-sm font-bold text-zinc-950 transition-all hover:bg-radium-green-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_24px_rgba(212,255,0,0.2)]"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                            <span className="relative flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer Link */}
                    <div className="mt-8 flex items-center justify-between text-xs font-medium">
                        <Link
                            href="/forgot-password"
                            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                            Forgot Password?
                        </Link>
                        <Link
                            href="/register"
                            className="text-radium-green hover:text-radium-green-hover transition-colors flex items-center gap-1"
                        >
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
