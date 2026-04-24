'use client'

import Link from "next/link";
import {
  ArrowRight, Zap, Wand2, MapPin, Bike, LayoutDashboard,
  Route, Package, CheckCircle2, IndianRupee, Radio,
  Layers, Box, RefreshCw, Map, ChevronRight
} from "lucide-react";

// SwiperJS — used for the mobile feature carousel
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'

// ── Step pill ────────────────────────────────────────────────────────────────
function Step({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-radium-green/10 border border-radium-green/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-radium-green font-black text-sm">{n}</span>
      </div>
      <div>
        <p className="font-bold text-white text-sm">{label}</p>
        <p className="text-zinc-300 text-xs mt-0.5 leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────
const FEATURES = [
  {
    num: "01",
    icon: <RefreshCw className="w-7 h-7" />,
    title: "Smart Batch Compute",
    desc: "generate_smart_batches() RPC clusters nearby orders into optimized groups using a TSP nearest-neighbour heuristic.",
    color: "text-radium-green",
    glow: "bg-radium-green",
    border: "group-hover:border-radium-green/40",
    tag: "Postgres RPC · TSP",
    wide: true,
  },
  {
    num: "02",
    icon: <Radio className="w-7 h-7" />,
    title: "Live Realtime Sync",
    desc: "Supabase Postgres Changes WebSocket keeps dashboard and rider app in perfect sync — zero polling.",
    color: "text-emerald-400",
    glow: "bg-emerald-500",
    border: "group-hover:border-emerald-500/40",
    tag: "WebSocket · Realtime",
  },
  {
    num: "03",
    icon: <Map className="w-7 h-7" />,
    title: "Google Maps Turn-by-Turn",
    desc: "Full-screen DirectionsRenderer updates live as the rider progresses through each pickup and delivery.",
    color: "text-amber-400",
    glow: "bg-amber-500",
    border: "group-hover:border-amber-500/40",
    tag: "Maps API · DirectionsRenderer",
  },
  {
    num: "04",
    icon: <LayoutDashboard className="w-7 h-7" />,
    title: "Admin Dispatch Panel",
    desc: "Two-panel UI: batches left, riders right. Magic Wand for auto-dispatch or manual click-to-assign.",
    color: "text-white",
    glow: "bg-white",
    border: "group-hover:border-white/20",
    tag: "Multi-panel · Admin",
  },
  {
    num: "05",
    icon: <Wand2 className="w-7 h-7" />,
    title: "PostGIS Auto-Dispatch",
    desc: "find_nearest_rider uses ST_Distance on geography columns to locate the closest idle rider in a single atomic Postgres query.",
    color: "text-indigo-400",
    glow: "bg-indigo-500",
    border: "group-hover:border-indigo-500/40",
    tag: "ST_Distance · geography",
  },
  {
    num: "06",
    icon: <IndianRupee className="w-7 h-7" />,
    title: "Transparent Payout Engine",
    desc: "Per-km rate per tenant. Riders see exact ₹ payout before accepting — haversine distance calculated client-side.",
    color: "text-yellow-400",
    glow: "bg-yellow-500",
    border: "group-hover:border-yellow-500/40",
    tag: "Haversine · Per-km rate",
  },
  {
    num: "07",
    icon: <Bike className="w-7 h-7" />,
    title: "Accept / Decline Flow",
    desc: "Notification chime via Web Audio API. Decline calls /api/rider/decline with service-role, returning the batch to queue.",
    color: "text-sky-400",
    glow: "bg-sky-500",
    border: "group-hover:border-sky-500/40",
    tag: "Web Audio · service-role",
  },
  {
    num: "08",
    icon: <MapPin className="w-7 h-7" />,
    title: "GPS Location Tracking",
    desc: "profiles.last_location (GEOGRAPHY) updated every 30s via watchPosition — powers PostGIS proximity queries.",
    color: "text-rose-400",
    glow: "bg-rose-500",
    border: "group-hover:border-rose-500/40",
    tag: "GEOGRAPHY · watchPosition",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-50 font-sans overflow-x-hidden selection:bg-[#d4ff00]/30">
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .card-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%);
          background-size: 200% 100%;
          animation: shimmer 15s infinite linear;
          border-radius: inherit;
          pointer-events: none;
        }
      `}</style>

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vh] bg-[#d4ff00]/12 blur-[160px] rounded-full animate-float" />
        <div className="absolute top-[10%] right-[-10%] w-[35vw] h-[45vh] bg-emerald-600/8 blur-[160px] rounded-full animate-float-slow" />
        <div className="absolute bottom-[10%] left-[20%] w-[40vw] h-[30vh] bg-indigo-900/8 blur-[120px] rounded-full" />
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <img src="/images/logo-1.png" alt="BatchFlow" className="md:w-44 w-28" />
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
            <a href="#roles" className="hover:text-white transition-colors">For Riders</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Log in
            </Link>
            <Link
              href="/register/business"
              className="h-10 px-5 bg-radium-green hover:bg-radium-green-hover text-zinc-900 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(212,255,0,0.25)]"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero BG image */}
      <div className="absolute top-0 left-0 w-full h-screen opacity-25 pointer-events-none">
        <img src="/images/hero-bg-1.png" className="w-full h-full object-cover" alt="" />
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-48 md:pb-28 pb-12 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-radium-green/10 border border-radium-green/20 text-radium-green text-xs font-bold uppercase tracking-widest mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-radium-green animate-pulse" />
          Real-time Logistics Dispatch
        </div>

        <h1 className="text-5xl w-full max-w-2xl md:text-7xl font-black tracking-tighter mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-zinc-500 wrap-normal">
          Smart Batching, Instant Dispatch
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed">
          BatchFlow groups pending orders into optimized delivery batches, auto-assigns the nearest available rider and guides them turn-by-turn all in real time.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <Link
            href="/register/business"
            className="h-14 px-8 bg-radium-green hover:bg-radium-green-hover text-zinc-950 rounded-full text-base font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_40px_rgba(212,255,0,0.2)] w-full sm:w-auto hover:scale-105"
          >
            Get Started Free <Zap className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="h-14 px-8 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white rounded-full text-base font-semibold flex items-center justify-center gap-2 transition-all w-full sm:w-auto"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how" className="md:py-24 py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-radium-green text-xs font-bold uppercase tracking-widest mb-4">End-to-End Flow</p>
            <h2 className="text-4xl md:text-5xl font-black mb-10 tracking-tight">From order to<br />doorstep in 4 steps.</h2>
            <div className="flex flex-col gap-8">
              <Step n="1" label="Orders Come In" sub="Businesses add orders with pickup & drop addresses via the admin panel. Orders sit in the pending queue with full geographic metadata." />
              <Step n="2" label="Smart Batch Generation" sub="'Compute Routes' runs generate_smart_batches() — a Postgres RPC that clusters nearby orders into optimized delivery groups using a TSP nearest-neighbour heuristic." />
              <Step n="3" label="Auto-Dispatch to Nearest Rider" sub="The Magic Wand calls find_nearest_rider() — a PostGIS ST_Distance query that finds the closest idle, online rider and assigns them the batch in one click." />
              <Step n="4" label="Rider Navigates & Confirms" sub="The rider sees a swipeable task card UI with Google Maps routing, confirms pickups and deliveries one by one. The dashboard updates live via Supabase Realtime." />
            </div>
          </div>

          {/* Visual flow diagram */}
          <div className="relative hidden md:flex flex-col gap-4">
            {[
              { icon: <Package className="w-5 h-5 text-zinc-300" />, label: "Pending Orders", tag: "pending", color: "border-zinc-700" },
              { icon: <Layers className="w-5 h-5 text-amber-400" />, label: "Batch Generated", tag: "unassigned", color: "border-amber-500/40" },
              { icon: <Wand2 className="w-5 h-5 text-indigo-400" />, label: "Auto-Assigned via PostGIS", tag: "assigned", color: "border-indigo-500/40" },
              { icon: <CheckCircle2 className="w-5 h-5 text-radium-green" />, label: "Rider Delivers", tag: "active → completed", color: "border-radium-green/40" },
            ].map((row, i) => (
              <div key={i}>
                <div className={`flex items-center gap-4 px-5 py-4 bg-zinc-900/70 backdrop-blur-xl border ${row.color} rounded-2xl`}>
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">{row.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{row.label}</p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">status: <span className="text-zinc-300">{row.tag}</span></p>
                  </div>
                  <span className="text-zinc-700 font-mono text-lg font-bold">{i + 1}</span>
                </div>
                {i < 3 && <div className="flex justify-center my-1"><div className="w-px h-5 bg-white/10" /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES — Awwwards bento (desktop) + Swiper (mobile) ─────────── */}
      <section id="features" className="md:py-24 py-12 bg-zinc-950 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-radium-green text-xs font-bold uppercase tracking-widest mb-3">Platform Features</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-16">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
              Everything<br /><span className="text-zinc-500">you need.</span>
            </h2>
            <p className="text-zinc-400 text-base max-w-xs md:text-right leading-relaxed">
              Full-stack logistics engine — database to driver UI, zero external dispatch middleware.
            </p>
          </div>
        </div>

        {/* ── MOBILE: free-scroll swiper ─────────────────────── */}
        <div className="md:hidden pl-6">
          <Swiper
            modules={[FreeMode]}
            freeMode={{ enabled: true, sticky: false }}
            slidesPerView="auto"
            spaceBetween={12}
            grabCursor
          >
            {FEATURES.map((f) => (
              <SwiperSlide key={f.num} style={{ width: '80vw', maxWidth: 320 }}>
                <div className={`relative card-shimmer group h-full min-h-[240px] bg-zinc-900 border border-white/5 ${f.border} rounded-[24px] p-6 flex flex-col justify-between overflow-hidden transition-all duration-300`}>
                  {/* glow blob */}
                  <div className={`absolute -top-10 -right-10 w-36 h-36 ${f.glow}/10 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  {/* number */}
                  <span className="absolute top-4 right-5 text-6xl font-black text-white/4 select-none leading-none">{f.num}</span>
                  <div className="relative z-10">
                    <div className={`${f.color} mb-4`}>{f.icon}</div>
                    <h3 className="text-lg font-black text-white mb-2 leading-tight">{f.title}</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                  <span className={`mt-4 self-start text-[10px] font-mono font-bold ${f.color} bg-white/4 border border-white/8 px-2.5 py-1 rounded-full`}>
                    {f.tag}
                  </span>
                </div>
              </SwiperSlide>
            ))}
            {/* trailing spacer */}
            <SwiperSlide style={{ width: 24 }} />
          </Swiper>
        </div>

        {/* ── DESKTOP: editorial bento grid ─────────────────── */}
        <div className="hidden md:block px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-3 auto-rows-auto gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.num}
                className={`relative card-shimmer group bg-zinc-900 border border-white/5 ${f.border} rounded-[28px] p-8 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.4)] ${f.wide ? 'col-span-2' : 'col-span-1'}`}
                style={{ minHeight: f.wide ? 220 : 260 }}
              >
                {/* accent glow */}
                <div className={`absolute -top-16 -right-16 w-56 h-56 ${f.glow}/10 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                {/* oversized number */}
                <span className="absolute bottom-4 right-6 text-[120px] font-black text-white/[0.03] select-none leading-none pointer-events-none">
                  {f.num}
                </span>

                <div className="relative z-10 flex-1 flex flex-col">
                  <div className={`${f.color} mb-5`}>{f.icon}</div>
                  <h3 className="text-xl font-black text-white mb-2 leading-tight">{f.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed flex-1">{f.desc}</p>
                </div>

                <div className="relative z-10 mt-6 flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold ${f.color} bg-white/4 border border-white/8 px-2.5 py-1 rounded-full`}>
                    {f.tag}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${f.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR RIDERS ───────────────────────────────────────────────────── */}
      <section id="roles" className="md:py-24 py-12 px-6 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-zinc-900/30 -z-10" />
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-radium-green text-xs font-bold uppercase tracking-widest mb-4">Rider Experience</p>
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Mobile-first.<br />Zero friction.</h2>
            <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
              Riders get a purpose-built app — tap to go online, receive job offers with payout previews, navigate with Google Maps, and confirm pickups & deliveries with a single tap.
            </p>
            <ul className="space-y-4">
              {[
                "One-tap Online / Offline toggle with GPS activation",
                "Job offer card: stops, km, ₹ payout before accepting",
                "Swipeable task cards for each pickup and delivery",
                "Auto-phase switch from COLLECTING → DELIVERING",
                "Decline returns batch to queue — admin re-dispatches",
              ].map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-radium-green" />
                  <span className="text-zinc-300 text-sm font-medium">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rider phone mock */}
          <div className="flex justify-center">
            <div className="w-72 rounded-[40px] bg-zinc-900 border-4 border-zinc-800 overflow-hidden shadow-[0_0_80px_rgba(212,255,0,0.08)] relative">
              <div className="flex items-center justify-between px-6 py-3 bg-zinc-950 border-b border-white/5">
                <span className="text-[10px] text-zinc-500 font-mono">BATCH · A3F2</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-radium-green animate-pulse" />
                  <span className="text-[10px] text-radium-green font-bold">ONLINE</span>
                </div>
              </div>
              <div className="h-44 bg-zinc-800/60 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,255,0,0.05),transparent_70%)]" />
                <div className="grid grid-cols-6 grid-rows-4 gap-px opacity-10 absolute inset-0">
                  {Array.from({ length: 24 }).map((_, i) => <div key={i} className="bg-white/20" />)}
                </div>
                <Map className="w-10 h-10 text-radium-green/40" />
              </div>
              <div className="p-4 bg-[#141416]">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-radium-green bg-radium-green/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Pickup</span>
                    <span className="text-[10px] text-zinc-500 font-mono">ID · 7C3A</span>
                  </div>
                  <div className="flex items-start gap-2 mb-4">
                    <MapPin className="w-4 h-4 text-radium-green shrink-0 mt-0.5" />
                    <p className="text-white text-sm font-bold leading-tight">Koramangala, 80ft Road, Near Sony Centre</p>
                  </div>
                  <button className="w-full py-3 bg-radium-green rounded-2xl text-zinc-950 text-xs font-black flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Confirm Pickup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <footer className="py-28 px-6 flex flex-col items-center text-center relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-radium-green/4 blur-[120px] -z-10" />
        <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">Ready to dispatch?</h2>
        <p className="text-xl text-zinc-400 mb-10 max-w-lg">
          Register your business, add riders, and start dispatching in minutes — no setup fees, no per-rider limits.
        </p>
        <Link
          href="/register/business"
          className="h-16 px-10 bg-radium-green hover:bg-radium-green-hover text-zinc-950 rounded-full text-lg font-black flex items-center gap-3 transition-all shadow-[0_0_40px_rgba(212,255,0,0.2)] hover:scale-105"
        >
          Create Your Business <ArrowRight className="w-5 h-5" />
        </Link>
        <Link href="/login" className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Already have an account? Log in →
        </Link>

        <div className="mt-20 pt-8 border-t border-white/5 w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-600 text-sm">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" /> BatchFlow · Logistics OS
          </div>
          <p className="text-xs text-zinc-700">Next.js · Supabase · PostGIS · Google Maps</p>
        </div>
      </footer>
    </div>
  );
}
