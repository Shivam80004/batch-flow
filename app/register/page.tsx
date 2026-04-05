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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-float"></div>
                <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px] mix-blend-screen animate-float-slow"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(9,9,11,1)_80%)]"></div>
            </div>

            <div className="relative z-10 w-full max-w-[420px]">
                {/* Glass Card */}
                <div className="glass-card rounded-[24px] p-10 transform transition-all hover:scale-[1.01] duration-500">

                    {/* Header */}
                    <div className="mb-10 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 glow-indigo transform transition duration-500 hover:-rotate-12">
                            <Package className="w-7 h-7 text-indigo-400" />
                        </div>
                        <h1 className="text-3xl font-semibold text-white tracking-tight glow-text-indigo mb-2">
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
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                <input
                                    id="businessName"
                                    type="text"
                                    required
                                    placeholder="Acme Logistics"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                                Work Email
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    placeholder="your@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="block text-xs font-medium text-zinc-400 ml-1 uppercase tracking-wider">
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative mt-2 group overflow-hidden rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed glow-indigo"
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
                            className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 ml-1"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
