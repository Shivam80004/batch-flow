'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Building, Loader2, Package } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';

export default function Register() {
    const router = useRouter();
    const [businessName, setBusinessName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) {
                throw authError;
            }

            const user = authData.user;
            if (!user) {
                throw new Error('No user returned from sign up');
            }

            const { error: tenantError } = await supabase
                .from('tenants')
                .insert([
                    { name: businessName, owner_id: user.id }
                ]);

            if (tenantError) {
                throw tenantError;
            }

            router.refresh();
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'An error occurred during registration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
            {/* Cinematic Background */}


            <div className="relative z-10 w-full h-full max-w-[420px]">
                {/* Glass Card */}
                <div className=" h-full rounded-[32px] p-10 transform transition-all hover:scale-[1.01] duration-500 text-white">

                    {/* Header */}
                    <div className="mb-10 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-radium-green/10 border border-radium-green/20 rounded-2xl flex items-center justify-center mb-6 glow-radium transform transition duration-500 hover:-rotate-12">
                            <Package className="w-7 h-7 text-radium-green" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            Create Account
                        </h1>
                        <p className="text-zinc-400 text-sm font-medium tracking-wide">
                            Register your logistics business
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 backdrop-blur-md">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Business Name Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="businessName" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                                Business Name
                            </label>
                            <div className="relative group">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-radium-green transition-colors pointer-events-none" />
                                <input
                                    id="businessName"
                                    type="text"
                                    required
                                    placeholder="Acme Logistics"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-radium-green/50 focus:ring-1 focus:ring-radium-green/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                                Work Email
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-radium-green transition-colors pointer-events-none" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    placeholder="your@company.com"
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
                                    autoComplete="new-password"
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
                                        Registering...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer Link */}
                    <div className="mt-8 text-center text-xs font-medium text-zinc-400">
                        Already have an account?{' '}
                        <Link
                            href="/login"
                            className="text-radium-green hover:text-radium-green-hover transition-colors inline-flex items-center gap-1 ml-1"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
