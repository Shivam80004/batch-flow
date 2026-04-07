import Link from "next/link";
import { ArrowRight, Box, Route, Zap, Shield, Map, Layers, LayoutDashboard, Users, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans overflow-x-hidden selection:bg-[#d4ff00]/30">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vh] bg-[#d4ff00]/15 blur-[150px] rounded-full animate-float"></div>
        <div className="absolute top-[10%] right-[-10%] w-[30vw] h-[40vh] bg-emerald-600/10 blur-[150px] rounded-full animate-float-slow"></div>
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[30vh] bg-amber-600/5 blur-[120px] rounded-full animate-float"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-radium-green/10 border border-radium-green/30 flex items-center justify-center glow-radium">
              <Box className="w-4 h-4 text-radium-green" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">BatchFlow</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
            <a href="#demo" className="hover:text-white transition-colors">Platform</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/register" className="h-10 px-5 bg-radium-green hover:bg-radium-green-hover text-zinc-900 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(212,255,0,0.3)]">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-radium-green/30 bg-radium-green/10 text-radium-green text-xs font-semibold tracking-widest uppercase animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-radium-green animate-pulse glow-radium"></span>
          Next-Gen Logistics OS
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-zinc-500">
          Orchestrate Delivery <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-radium-green to-emerald-400 drop-shadow-[0_0_10px_rgba(212,255,0,0.5)]">At Light Speed</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed">
          BatchFlow empowers modern fleets with AI-driven routing, cinematic control panels, and seamless driver interfaces. Built for the businesses of tomorrow.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <Link href="/register" className="h-14 px-8 bg-zinc-100 text-zinc-950 hover:bg-white rounded-full text-base font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] w-full sm:w-auto hover:scale-105">
            Start Free Trial <Zap className="w-5 h-5" />
          </Link>
          <Link href="/login" className="h-14 px-8 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white rounded-full text-base font-bold flex items-center justify-center gap-2 transition-all w-full sm:w-auto">
            View Live Demo
          </Link>
        </div>

        {/* Hero Image / Dashboard Mock */}
        <div className="w-full mt-24 relative perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 bottom-0 top-1/2"></div>
          <div className="w-full h-[600px] glass-panel rounded-[32px] md:rounded-[48px] border border-white/10 overflow-hidden relative shadow-[0_0_100px_rgba(212,255,0,0.1)] transform rotate-x-[5deg] scale-[0.95] hover:scale-100 transition-transform duration-1000 ease-out">
            {/* Mock UI Header */}
            <div className="w-full h-16 border-b border-white/5 flex items-center px-8 bg-black/40">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
              </div>
            </div>
            {/* Mock UI Body */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 h-full bg-zinc-950/50">
              <div className="col-span-2 h-full rounded-2xl border border-white/5 bg-zinc-900/50 p-6 flex flex-col justify-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-radium-green/20 blur-[80px]"></div>
                <h3 className="text-2xl font-bold mb-2">Live Fleet Map</h3>
                <p className="text-zinc-500">Real-time driver tracking and AI pathing.</p>
              </div>
              <div className="flex flex-col gap-6 h-full">
                <div className="flex-1 rounded-2xl border border-white/5 bg-zinc-900/50 p-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center glow-emerald mb-4"><Activity className="w-5 h-5 text-emerald-400" /></div>
                  <div className="text-3xl font-bold text-white mb-1">98.4%</div>
                  <div className="text-xs text-zinc-500">On-time Delivery Rate</div>
                </div>
                <div className="flex-1 rounded-2xl border border-white/5 bg-zinc-900/50 p-6">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center glow-amber mb-4"><Route className="w-5 h-5 text-amber-400" /></div>
                  <div className="text-3xl font-bold text-white mb-1">12.4k</div>
                  <div className="text-xs text-zinc-500">Miles Optimized</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 px-6 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Designed for Dominance.</h2>
            <p className="text-xl text-zinc-400 max-w-2xl">Stop fighting legacy software. Our unified platform combines everything you need to run logistics at scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Big Feature */}
            <div className="md:col-span-2 glass-panel p-8 md:p-12 rounded-[32px] group relative overflow-hidden border border-white/5 hover:border-radium-green/30 transition-colors">
              <div className="absolute top-0 right-[-10%] w-96 h-96 bg-[#d4ff00]/10 blur-[100px] group-hover:bg-[#d4ff00]/20 transition-colors"></div>
              <LayoutDashboard className="w-12 h-12 text-radium-green mb-8" />
              <h3 className="text-3xl font-bold mb-4">Cinematic Control Panel</h3>
              <p className="text-zinc-400 text-lg max-w-md">Command your entire fleet from an ultra-modern, glassmorphic dashboard built for high-contrast visibility and speed.</p>
            </div>

            <div className="glass-panel p-8 rounded-[32px] group border border-white/5 hover:border-emerald-500/30 transition-colors relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-600/10 blur-[60px] group-hover:bg-emerald-600/20 transition-colors"></div>
              <Route className="w-12 h-12 text-emerald-400 mb-8" />
              <h3 className="text-2xl font-bold mb-3">TSP Routing AI</h3>
              <p className="text-zinc-400">Instantly generate the fastest multi-stop routes using our advanced Traveling Salesperson heuristics.</p>
            </div>

            <div className="glass-panel p-8 rounded-[32px] group border border-white/5 hover:border-amber-500/30 transition-colors relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-amber-600/10 blur-[60px] group-hover:bg-amber-600/20 transition-colors"></div>
              <Map className="w-12 h-12 text-amber-400 mb-8" />
              <h3 className="text-2xl font-bold mb-3">Driver App</h3>
              <p className="text-zinc-400">A stunning, mobile-first Rider Interface with Google Maps turn-by-turn integration.</p>
            </div>

            <div className="md:col-span-2 glass-panel p-8 md:p-12 rounded-[32px] group relative overflow-hidden border border-white/5 hover:border-radium-green/30 transition-colors flex flex-col justify-end min-h-[300px]">
              <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-radium-green/10 blur-[50px] group-hover:from-radium-green/20 transition-colors"></div>
              <Shield className="w-12 h-12 text-white mb-8" />
              <h3 className="text-3xl font-bold mb-4">Enterprise Multi-Tenancy</h3>
              <p className="text-zinc-400 text-lg max-w-md">Built on Supabase. Each organization runs in strict isolation with dedicated Row Level Security.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-32 px-6 border-t border-white/5 border-b relative">
        <div className="absolute inset-0 bg-zinc-900/30 -z-10"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Built for any fleet.</h2>
            <ul className="space-y-8">
              <li className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6 text-radium-green" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">B2B Logistics</h4>
                  <p className="text-zinc-400">Manage massive volume cross-docking and complex multi-stop routes with ease.</p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">On-Demand Delivery</h4>
                  <p className="text-zinc-400">Dispatch instantly. Real-time pooling ensures drivers always get the closest tasks.</p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Box className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">E-Commerce Last Mile</h4>
                  <p className="text-zinc-400">Provide an unparalleled tracking experience for end customers while optimizing fleet costs.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="flex-1 w-full glass-panel rounded-[40px] p-8 border border-white/10 relative overflow-hidden h-[500px] flex items-center justify-center">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]"></div>
            <div className="w-48 h-48 rounded-full border border-radium-green/20 absolute flex items-center justify-center animate-[spin_10s_linear_infinite]">
              <div className="w-full h-full rounded-full border border-dashed border-radium-green/50"></div>
              <div className="w-3 h-3 bg-radium-green rounded-full glow-radium absolute top-[-6px]"></div>
            </div>
            <div className="w-24 h-24 rounded-full bg-zinc-950 border border-white/10 flex items-center justify-center z-10 shadow-[0_0_40px_rgba(212,255,0,0.15)]">
              <Box className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="py-32 px-6 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute inset-0 top-1/2 bg-radium-green/5 blur-[100px] -z-10 rounded-t-[100%]"></div>
        <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to move faster?</h2>
        <p className="text-xl text-zinc-400 mb-12 max-w-lg">Join the platform redefining modern logistics operations.</p>
        <Link href="/register" className="h-16 px-10 bg-radium-green hover:bg-radium-green-hover text-zinc-950 rounded-full text-lg font-bold flex items-center gap-3 transition-all shadow-[0_0_30px_rgba(212,255,0,0.2)] hover:scale-105">
          Get Started Now <ArrowRight className="w-5 h-5" />
        </Link>

        <div className="mt-32 pt-8 border-t border-white/5 w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-500 text-sm">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" /> BatchFlow Inc.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}


