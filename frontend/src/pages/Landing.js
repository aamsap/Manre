import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ForkKnife, Clock, Scales } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const HERO = "https://images.unsplash.com/photo-1765582870011-ff3cfdb06700?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwZW9wbGUlMjBzaGFyaW5nJTIwZm9vZCUyMGNvbW11bml0eXxlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=1400";

export default function Landing() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.get("/stats/impact").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const pct = stats ? Math.min(100, Math.round((stats.kg_saved / stats.target_kg) * 100)) : 0;

  const counter = (
    <div data-testid="impact-counter" className="rounded-3xl border border-line bg-white p-5 shadow-warm md:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate2">Target makanan diselamatkan</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-heading text-4xl font-black tabular-nums text-forest md:text-5xl" data-testid="kg-saved">
          {stats?.kg_saved ?? 0}
        </span>
        <span className="pb-1 text-sm font-semibold text-slate2">/ {stats?.target_kg ?? 500} kg</span>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-sand">
        <motion.div className="h-full rounded-full bg-clay" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate2">
        <span data-testid="portions-saved">{stats?.portions_saved ?? 0} porsi dibagi</span>
        <span>{stats?.handoffs ?? 0} serah terima</span>
        <span>{stats?.members ?? 0} warga bergabung</span>
      </div>
    </div>
  );

  const pills = (
    <div className="grid grid-cols-3 gap-3">
      {[{ i: ForkKnife, t: "Matang & bahan" }, { i: Clock, t: "Auto kadaluarsa" }, { i: Scales, t: "Hitung kg" }].map(({ i: I, t }) => (
        <div key={t} className="rounded-2xl border border-line bg-white/70 p-3 text-center">
          <I size={20} weight="duotone" className="mx-auto text-clay" />
          <p className="mt-1 text-[11px] font-bold leading-tight text-ink">{t}</p>
        </div>
      ))}
    </div>
  );

  const cta = (
    <>
      <button
        data-testid="get-started-btn"
        onClick={() => navigate(user ? "/feed" : "/login")}
        className="press flex w-full items-center justify-center gap-2 rounded-full bg-clay py-4 font-heading text-base font-extrabold text-white shadow-warmlg hover:bg-clay-dark md:w-auto md:px-10"
      >
        {user ? "Buka feed" : "Mulai bagi makanan"} <ArrowRight size={18} weight="bold" />
      </button>
      <button
        data-testid="terms-link"
        onClick={() => navigate("/terms")}
        className="mx-auto mt-3 block text-xs font-semibold text-slate2 underline md:mx-0"
      >
        Syarat & Ketentuan
      </button>
    </>
  );

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      {/* mobile */}
      <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-sand shadow-2xl md:hidden" data-testid="landing-page">
        <div className="relative h-[58vh] overflow-hidden">
          <img src={HERO} alt="Warga berbagi makanan" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-sand" />
          <div className="absolute inset-x-6 top-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-forest">
              <Leaf size={12} weight="fill" /> Manre
            </span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-6 bottom-6"
          >
            <h1 className="font-heading text-4xl font-black leading-[0.95] tracking-tight text-white drop-shadow-lg">
              Bagi makanan<br />yuk, jangan<br />
              <span className="text-honey">dibuang.</span>
            </h1>
          </motion.div>
        </div>
        <div className="relative -mt-4 space-y-6 px-6 pb-12">
          <p className="text-base leading-relaxed text-slate2">
            Punya masakan lebih atau bahan yang nggak kepakai? Kasih ke orang di sekitarmu
            sebelum keburu basi. Gratis, non-komersial, di mana pun kamu tinggal.
          </p>
          {counter}
          {pills}
          <div>{cta}</div>
        </div>
      </div>

      {/* tablet & desktop */}
      <div className="hidden min-h-screen md:block" data-testid="landing-page-desktop">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
          <span className="font-heading text-2xl font-black tracking-tight text-forest">Manre</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/terms")} className="press text-sm font-bold text-slate2">Syarat & Ketentuan</button>
            <button data-testid="desktop-login-btn" onClick={() => navigate(user ? "/feed" : "/login")}
              className="press rounded-full bg-forest px-6 py-2.5 text-sm font-extrabold text-white">
              {user ? "Buka feed" : "Masuk"}
            </button>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-8 py-10 lg:grid-cols-2">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-ink lg:text-6xl"
            >
              Bagi makanan yuk,<br />jangan <span className="text-clay">dibuang.</span>
            </motion.h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate2">
              Manre menghubungkan orang yang punya masakan atau bahan berlebih dengan orang di
              sekitarnya — sebelum keburu basi. Gratis, non-komersial, bisa dipakai di mana pun.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">{cta}</div>
            <div className="mt-10 max-w-md">{pills}</div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}
              className="overflow-hidden rounded-[2rem] shadow-warmlg"
            >
              <img src={HERO} alt="Warga berbagi makanan" className="h-80 w-full object-cover" />
            </motion.div>
            {counter}
          </div>
        </div>
      </div>
    </div>
  );
}
