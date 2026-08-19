import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ForkKnife, Clock, MapPin } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const HERO = "https://images.unsplash.com/photo-1765582870011-ff3cfdb06700?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxwZW9wbGUlMjBzaGFyaW5nJTIwZm9vZCUyMGNvbW11bml0eXxlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=1000";

export default function Landing() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.get("/stats/impact").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const pct = stats ? Math.min(100, Math.round((stats.portions_saved / stats.target_portions) * 100)) : 0;

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-sand shadow-2xl" data-testid="landing-page">
        <div className="relative h-[58vh] overflow-hidden">
          <img src={HERO} alt="Warga berbagi makanan" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-sand" />
          <div className="absolute inset-x-6 top-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-forest">
              <MapPin size={12} weight="fill" /> Berbagi di lingkunganmu
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

        <div className="relative -mt-4 px-6">
          <p className="text-base leading-relaxed text-slate2">
            Punya masakan lebih atau bahan yang nggak kepakai? Kasih ke tetangga sekitar
            sebelum keburu basi. Gratis, non-komersial, sesama warga.
          </p>

          <div data-testid="impact-counter" className="mt-6 rounded-3xl border border-line bg-white p-5 shadow-warm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate2">Target makanan diselamatkan</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-heading text-4xl font-black tabular-nums text-forest" data-testid="portions-saved">
                {stats?.portions_saved ?? 0}
              </span>
              <span className="pb-1 text-sm font-semibold text-slate2">/ {stats?.target_portions ?? 1000} porsi</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-sand">
              <motion.div className="h-full rounded-full bg-clay" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
            </div>
            <div className="mt-3 flex justify-between text-xs font-semibold text-slate2">
              <span>{stats?.handoffs ?? 0} serah terima</span>
              <span>{stats?.members ?? 0} warga bergabung</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[{ i: ForkKnife, t: "Matang & bahan" }, { i: Clock, t: "Auto kadaluarsa" }, { i: Leaf, t: "Radius 1 km" }].map(({ i: I, t }) => (
              <div key={t} className="rounded-2xl border border-line bg-white/70 p-3 text-center">
                <I size={20} weight="duotone" className="mx-auto text-clay" />                <p className="mt-1 text-[11px] font-bold leading-tight text-ink">{t}</p>
              </div>
            ))}
          </div>

          <button
            data-testid="get-started-btn"
            onClick={() => navigate(user ? "/feed" : "/login")}
            className="press mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-clay py-4 font-heading text-base font-extrabold text-white shadow-warmlg hover:bg-clay-dark"
          >
            {user ? "Buka feed" : "Mulai bagi makanan"} <ArrowRight size={18} weight="bold" />
          </button>
          <button
            data-testid="terms-link"
            onClick={() => navigate("/terms")}
            className="mx-auto mt-3 block pb-10 text-xs font-semibold text-slate2 underline"
          >
            Syarat & Ketentuan
          </button>
        </div>
      </div>
    </div>
  );
}
