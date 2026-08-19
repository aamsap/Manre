import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { BowlFood, HandHeart, Crosshair, CheckCircle } from "@phosphor-icons/react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ZONE = { lat: -7.9526, lng: 112.6142 };

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState(null);
  const [busy, setBusy] = useState(false);
  const [located, setLocated] = useState(null);
  const [done, setDone] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const detectLocation = async (fallback = false) => {
    setBusy(true);
    const send = async (lat, lng) => {
      try {
        const { data } = await api.post("/me/location", { lat, lng });
        setLocated({ lat, lng, zone_verified: data.zone_verified, distance_m: data.distance_m });
        if (data.zone_verified) toast.success("Kamu di dalam zona pilot!");
        else toast.warning(`Kamu ${(data.distance_m / 1000).toFixed(1)} km dari pusat zona. Feed mungkin kosong.`);
      } catch (e) { toast.error(errMsg(e)); }
      setBusy(false);
    };
    if (fallback || !navigator.geolocation) return send(ZONE.lat, ZONE.lng);
    navigator.geolocation.getCurrentPosition(
      (p) => send(p.coords.latitude, p.coords.longitude),
      () => { toast.info("Izin lokasi ditolak — pakai titik tengah kampus UB."); send(ZONE.lat, ZONE.lng); },
      { timeout: 8000 }
    );
  };

  const finish = async () => {
    try {
      await api.post("/me/onboarded");
      await refresh();
      navigate("/feed", { replace: true });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const steps = [
    {
      title: "Kamu di sini sebagai?",
      body: (
        <div className="space-y-3">
          {[
            { k: "donor", icon: BowlFood, t: "Aku mau bagi", d: "Punya masakan/bahan lebih" },
            { k: "recipient", icon: HandHeart, t: "Aku mau ambil", d: "Cari makanan di sekitar" },
          ].map(({ k, icon: I, t, d }) => (
            <button
              key={k} data-testid={`role-${k}`} onClick={() => setRole(k)}
              className={`press flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left ${role === k ? "border-clay shadow-warmlg" : "border-line shadow-warm"}`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${role === k ? "bg-clay text-white" : "bg-sand text-forest"}`}>
                <I size={24} weight="fill" />
              </span>
              <span>
                <span className="block font-heading font-extrabold text-ink">{t}</span>
                <span className="block text-sm text-slate2">{d}</span>
              </span>
            </button>
          ))}
        </div>
      ),
      canNext: !!role,
    },
    {
      title: role === "donor" ? "Cara bagi makanan" : "Cara ambil makanan",
      body: (
        <ol className="space-y-3">
          {(role === "donor"
            ? ["Foto makanan/bahannya (wajib 1 foto)", "Isi porsi, catatan kondisi, jam bisa diambil", "Bagikan lokasimu & pilih cara serah terima (pin bisa digeser 100 m untuk privasi)", "Terima klaim, chat, lalu tap Selesai + kasih rating"]
            : ["Buka feed — terdekat & paling cepat basi muncul dulu", "Tap Klaim (slot terkunci 15 menit sampai donor setuju)", "Chat buat atur waktu ambil", "Setelah terima, tap Selesai + kasih rating"]
          ).map((t, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">{i + 1}</span>
              <span className="text-sm leading-snug text-ink">{t}</span>
            </li>
          ))}
        </ol>
      ),
      canNext: true,
    },
    {
      title: "Bagikan lokasimu",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-slate2">
            Manre bisa dipakai di mana pun. Kita cuma perlu titik lokasimu sekali saja buat
            ngitung jarak dan mengurutkan feed dari yang paling dekat.
          </p>
          <button
            data-testid="detect-location-btn" onClick={() => detectLocation(false)} disabled={busy}
            className="press flex w-full items-center justify-center gap-2 rounded-full bg-forest py-4 font-heading font-extrabold text-white disabled:opacity-60"
          >
            <Crosshair size={18} weight="bold" /> {busy ? "Mendeteksi..." : "Deteksi lokasiku"}
          </button>
          <button data-testid="use-zone-center-btn" onClick={() => detectLocation(true)} disabled={busy}
            className="w-full text-xs font-semibold text-slate2 underline">
            Pakai titik tengah kampus UB saja
          </button>
          <button data-testid="skip-location-btn" onClick={() => setDone(true)} className="w-full text-xs font-semibold text-slate2 underline">
            Nanti saja
          </button>
          {located !== null && (
            <div data-testid="zone-result" className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold ${located.zone_verified ? "bg-leaf/15 text-forest" : "bg-honey/25 text-ink"}`}>
              <CheckCircle size={18} weight="fill" />
              {located.zone_verified ? "Lokasi terverifikasi di zona pilot" : "Di luar zona — kamu masih bisa lihat feed"}
            </div>
          )}
          <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-slate2">
            Dengan lanjut, kamu setuju Manre bersifat gratis & non-komersial, dilarang menjual ulang makanan,
            dan setiap pihak bertanggung jawab atas kualitas/kondisi makanan yang dibagikan atau diterima.
          </p>
        </div>
      ),
      canNext: located !== null || done,
    },
  ];

  const s = steps[step];

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand px-6 pb-10 pt-10 shadow-2xl md:my-10 md:min-h-0 md:max-w-xl md:rounded-[2rem] md:px-10" data-testid="onboarding-page">
        <div className="mb-6 flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-clay" : "bg-line"}`} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
            <h1 className="font-heading text-3xl font-black tracking-tight text-ink">{s.title}</h1>
            <div className="mt-6">{s.body}</div>
          </motion.div>
        </AnimatePresence>
        <button
          data-testid="onboarding-next-btn" disabled={!s.canNext}
          onClick={() => (step === steps.length - 1 ? finish() : setStep(step + 1))}
          className="press mt-8 w-full rounded-full bg-clay py-4 font-heading font-extrabold text-white shadow-warmlg disabled:opacity-40"
        >
          {step === steps.length - 1 ? "Selesai, buka feed" : "Lanjut"}
        </button>
      </div>
    </div>
  );
}
