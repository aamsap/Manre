import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, BowlFood, Carrot, Handshake, MapPin, Truck, CheckCircle, Crosshair } from "@phosphor-icons/react";
import { MiniMap } from "@/components/MiniMap";
import { api, errMsg, mediaUrl } from "@/lib/api";

const ZONE = { lat: -7.9526, lng: 112.6142 };

const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function PostCreate() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState("");
  const [pos, setPos] = useState(ZONE);
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Browser tidak mendukung lokasi");
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocBusy(false); toast.success("Pakai lokasi sekarang"); },
      () => { setLocBusy(false); toast.error("Izin lokasi ditolak — geser pin manual di peta"); },
      { timeout: 8000 }
    );
  };
  const now = useMemo(() => new Date(), []);
  const [f, setF] = useState({
    category: "cooked", title: "", portions: 1, unit: "porsi", notes: "",
    prep_time: toLocalInput(now), handoff: "pickup", dropoff_name: "",
    window_start: toLocalInput(now), window_end: toLocalInput(new Date(now.getTime() + 4 * 3600000)),
    privacy_offset: true, responsibility_ack: false,
    weight_mode: "auto", weight_kg: "", auto_accept: false,
  });

  const maxH = f.category === "cooked" ? 6 : 48;
  const estKg = (f.category === "cooked" ? 0.4 : 1.0) * Math.max(1, Number(f.portions) || 1);

  const compressAndUpload = async (file) => {
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.72));
      const fd = new FormData();
      fd.append("file", blob, "foto.jpg");
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhoto(data.url);
      toast.success("Foto terunggah");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        category: f.category, title: f.title, portions: Number(f.portions),
        unit: f.category === "cooked" ? "porsi" : "paket", notes: f.notes, photo_url: photo,
        prep_time: f.category === "cooked" ? new Date(f.prep_time).toISOString() : null,
        best_before: new Date(f.window_end).toISOString(),
        handoff: f.handoff, dropoff_name: f.handoff === "dropoff" ? f.dropoff_name : null,
        window_start: new Date(f.window_start).toISOString(),
        window_end: new Date(f.window_end).toISOString(),
        lat: pos.lat, lng: pos.lng, privacy_offset: f.privacy_offset,
        responsibility_ack: f.responsibility_ack,
        weight_kg: f.weight_mode === "manual" && Number(f.weight_kg) > 0 ? Number(f.weight_kg) : null,
        auto_accept: f.auto_accept,
      };
      const { data } = await api.post("/posts", payload);
      toast.success("Mantap! Makananmu sudah tayang.");
      navigate(`/post/${data.id}`, { replace: true });
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const canNext = [
    !!photo && f.title.trim().length > 2,
    Number(f.portions) >= 1,
    f.handoff !== "dropoff" || f.dropoff_name.trim().length > 2,
    f.responsibility_ack,
  ][step];

  const inputCls = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-clay";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-slate2";

  const steps = [
    {
      title: "Apa yang mau dibagi?",
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[{ k: "cooked", t: "Makanan matang", i: BowlFood, d: "maks 6 jam" }, { k: "raw", t: "Bahan mentah", i: Carrot, d: "maks 48 jam" }].map(({ k, t, i: I, d }) => (
              <button key={k} data-testid={`cat-${k}`} onClick={() => setF({ ...f, category: k })}
                className={`press rounded-3xl border-2 bg-white p-4 text-left ${f.category === k ? "border-clay shadow-warmlg" : "border-line"}`}>
                <I size={26} weight="fill" className={f.category === k ? "text-clay" : "text-forest"} />
                <p className="mt-2 font-heading text-sm font-extrabold leading-tight text-ink">{t}</p>
                <p className="text-[11px] text-slate2">{d}</p>
              </button>
            ))}
          </div>

          <button data-testid="photo-upload-btn" onClick={() => fileRef.current?.click()}
            className="press relative flex h-44 w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-white">
            {photo ? <img src={mediaUrl(photo)} alt="preview" className="h-full w-full object-cover" /> : (
              <span className="text-center">
                <Camera size={30} weight="duotone" className="mx-auto text-clay" />
                <span className="mt-1 block text-sm font-bold text-ink">{busy ? "Mengunggah..." : "Ambil / pilih foto"}</span>
                <span className="text-xs text-slate2">Wajib 1 foto</span>
              </span>
            )}
          </button>
          <input ref={fileRef} data-testid="photo-input" type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && compressAndUpload(e.target.files[0])} />

          <div>
            <p className={labelCls}>Judul</p>
            <input data-testid="title-input" className={`${inputCls} mt-1.5`} value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder={f.category === "cooked" ? "Nasi goreng 4 porsi" : "Sayur & wortel segar"} />
          </div>
        </div>
      ),
    },
    {
      title: "Detail & waktu",
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Jumlah</p>
              <input data-testid="portions-input" type="number" min={1} className={`${inputCls} mt-1.5`}
                value={f.portions} onChange={(e) => setF({ ...f, portions: e.target.value })} />
            </div>
            <div>
              <p className={labelCls}>Satuan</p>
              <input disabled className={`${inputCls} mt-1.5 opacity-70`} value={f.category === "cooked" ? "porsi" : "paket"} />
            </div>
          </div>
          <div>
            <p className={labelCls}>Perkiraan berat</p>
            <div className="mt-1.5 flex gap-2">
              <button data-testid="weight-mode-auto" onClick={() => setF({ ...f, weight_mode: "auto" })}
                className={`press flex-1 rounded-full py-2.5 text-xs font-extrabold ${f.weight_mode === "auto" ? "bg-forest text-white" : "bg-white text-slate2 border border-line"}`}>
                Otomatis (±{estKg} kg)
              </button>
              <button data-testid="weight-mode-manual" onClick={() => setF({ ...f, weight_mode: "manual" })}
                className={`press flex-1 rounded-full py-2.5 text-xs font-extrabold ${f.weight_mode === "manual" ? "bg-forest text-white" : "bg-white text-slate2 border border-line"}`}>
                Koreksi manual
              </button>
            </div>
            {f.weight_mode === "manual" && (
              <input data-testid="weight-input" type="number" min={0.1} step={0.1} className={`${inputCls} mt-2`}
                value={f.weight_kg} onChange={(e) => setF({ ...f, weight_kg: e.target.value })}
                placeholder={`Berat total dalam kg (mis. ${estKg})`} />
            )}
            <p className="mt-1.5 text-xs text-slate2">
              Berat dipakai buat menghitung total makanan yang diselamatkan komunitas.
            </p>
          </div>
          <div>
            <p className={labelCls}>Catatan kondisi</p>
            <textarea data-testid="notes-input" rows={3} className={`${inputCls} mt-1.5 resize-none`} value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              placeholder="Masih anget, bawa wadah sendiri ya..." />
          </div>
          {f.category === "cooked" && (
            <div>
              <p className={labelCls}>Jam dimasak</p>
              <input data-testid="prep-time-input" type="datetime-local" className={`${inputCls} mt-1.5`} value={f.prep_time}
                onChange={(e) => setF({ ...f, prep_time: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Bisa diambil dari</p>
              <input data-testid="window-start-input" type="datetime-local" className={`${inputCls} mt-1.5`} value={f.window_start}
                onChange={(e) => setF({ ...f, window_start: e.target.value })} />
            </div>
            <div>
              <p className={labelCls}>Sampai (maks {maxH} jam)</p>
              <input data-testid="window-end-input" type="datetime-local" className={`${inputCls} mt-1.5`} value={f.window_end}
                onChange={(e) => setF({ ...f, window_end: e.target.value })} />
            </div>
          </div>
          <p className="rounded-2xl bg-honey/20 p-3 text-xs font-semibold text-ink">
            Post otomatis kadaluarsa saat jam akhir tercapai. {f.category === "cooked" ? "Makanan matang maks 6 jam." : "Bahan mentah maks 48 jam."}
          </p>
        </div>
      ),
    },
    {
      title: "Cara serah terima",
      body: (
        <div className="space-y-4">
          {[{ k: "pickup", t: "Diambil di tempatku", i: Handshake }, { k: "dropoff", t: "Titik netral", i: MapPin }, { k: "delivery", t: "Aku antar", i: Truck }].map(({ k, t, i: I }) => (
            <button key={k} data-testid={`handoff-${k}`} onClick={() => setF({ ...f, handoff: k })}
              className={`press flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-3.5 text-left ${f.handoff === k ? "border-forest shadow-warm" : "border-line"}`}>
              <I size={22} weight="fill" className={f.handoff === k ? "text-forest" : "text-slate2"} />
              <span className="font-heading text-sm font-extrabold text-ink">{t}</span>
            </button>
          ))}
          {f.handoff === "dropoff" && (
            <input data-testid="dropoff-name-input" className={inputCls} value={f.dropoff_name}
              onChange={(e) => setF({ ...f, dropoff_name: e.target.value })} placeholder="Nama titik netral (mis. pos ronda Jl. Veteran)" />
          )}
          <div>
            <div className="flex items-center justify-between">
              <p className={labelCls}>Lokasi serah terima</p>
              <button data-testid="use-my-location-btn" onClick={useMyLocation} disabled={locBusy}
                className="press flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white disabled:opacity-60">
                <Crosshair size={12} weight="bold" /> {locBusy ? "..." : "Lokasiku"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate2">Tap peta untuk geser pin.</p>
            <div className="mt-2 h-56 overflow-hidden rounded-2xl border border-line">
              <MiniMap testId="post-map" lat={pos.lat} lng={pos.lng} mode="pick"
                onPick={(lat, lng) => setPos({ lat, lng })} />
            </div>
            <label className="press mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
              <input data-testid="privacy-offset-checkbox" type="checkbox" checked={f.privacy_offset}
                onChange={(e) => setF({ ...f, privacy_offset: e.target.checked })} className="h-5 w-5 accent-clay" />
              <span className="text-xs font-semibold text-ink">Sembunyikan lokasi persis (digeser acak ~100 m)</span>
            </label>
            <label className="press mt-2 flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
              <input data-testid="auto-accept-checkbox" type="checkbox" checked={f.auto_accept}
                onChange={(e) => setF({ ...f, auto_accept: e.target.checked })} className="mt-0.5 h-5 w-5 accent-clay" />
              <span className="text-xs font-semibold leading-snug text-ink">
                Terima klaim otomatis — penerima langsung dapat konfirmasi tanpa nunggu kamu.
              </span>
            </label>
          </div>
        </div>
      ),
    },
    {
      title: "Konfirmasi & tayangkan",
      body: (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-warm">
            {photo && <img src={mediaUrl(photo)} alt="preview" className="h-40 w-full object-cover" />}
            <div className="space-y-1 p-4">
              <p className="font-heading text-lg font-extrabold text-ink">{f.title}</p>
              <p className="text-sm text-slate2">{f.portions} {f.category === "cooked" ? "porsi" : "paket"} · ±{f.weight_mode === "manual" && Number(f.weight_kg) > 0 ? Number(f.weight_kg) : estKg.toFixed(1)} kg · {f.category === "cooked" ? "matang" : "bahan mentah"}</p>
              <p className="text-sm text-slate2">{f.notes || "Tanpa catatan"}</p>
              {f.auto_accept && <p className="text-xs font-extrabold uppercase tracking-widest text-forest">Terima otomatis aktif</p>}
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border-2 border-clay/40 bg-white p-4">
            <input data-testid="responsibility-checkbox" type="checkbox" checked={f.responsibility_ack}
              onChange={(e) => setF({ ...f, responsibility_ack: e.target.checked })} className="mt-0.5 h-5 w-5 accent-clay" />
            <span className="text-sm font-semibold leading-snug text-ink">
              Saya bertanggung jawab atas kualitas makanan yang saya bagikan.
            </span>
          </label>
          <p className="text-xs leading-relaxed text-slate2">
            Post pertama sampai ketiga akan ditinjau admin sebelum tampil di feed publik.
          </p>
        </div>
      ),
    },
  ];

  const s = steps[step];

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand px-5 pb-10 pt-6 shadow-2xl md:my-8 md:min-h-0 md:max-w-2xl md:rounded-[2rem] md:px-8 md:py-8" data-testid="post-create-page">
        <div className="flex items-center justify-between">
          <button data-testid="post-back-btn" onClick={() => (step === 0 ? navigate("/feed") : setStep(step - 1))} className="press flex items-center gap-1 text-sm font-bold text-slate2">
            <ArrowLeft size={16} weight="bold" /> {step === 0 ? "Batal" : "Kembali"}
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate2">Langkah {step + 1}/4</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-clay" : "bg-line"}`} />)}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.28 }}>
            <h1 className="mt-6 font-heading text-2xl font-black tracking-tight text-ink">{s.title}</h1>
            <div className="mt-5">{s.body}</div>
          </motion.div>
        </AnimatePresence>

        <button
          data-testid="post-next-btn" disabled={!canNext || busy}
          onClick={() => (step === 3 ? submit() : setStep(step + 1))}
          className="press mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-clay py-4 font-heading font-extrabold text-white shadow-warmlg disabled:opacity-40"
        >
          {step === 3 ? <><CheckCircle size={18} weight="fill" /> {busy ? "Menayangkan..." : "Tayangkan"}</> : "Lanjut"}
        </button>
      </div>
    </div>
  );
}
