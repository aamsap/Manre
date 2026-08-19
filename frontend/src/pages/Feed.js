import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SlidersHorizontal, Bell, ShieldCheck } from "@phosphor-icons/react";
import { Shell } from "@/components/layout/Shell";
import { SurplusCard } from "@/components/feed/SurplusCard";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const cats = [{ k: "", t: "Semua" }, { k: "cooked", t: "Matang" }, { k: "raw", t: "Bahan" }];
const radii = [{ v: 0.5, t: "0.5 km" }, { v: 1, t: "1 km" }];
const handoffs = [{ k: "", t: "Semua cara" }, { k: "pickup", t: "Ambil sendiri" }, { k: "dropoff", t: "Titik netral" }, { k: "delivery", t: "Diantar" }];

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [f, setF] = useState({ category: "", radius_km: 1, handoff: "" });
  const [coords, setCoords] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (f.radius_km) params.radius_km = f.radius_km;
      if (f.category) params.category = f.category;
      if (f.handoff) params.handoff = f.handoff;
      if (coords) { params.lat = coords.lat; params.lng = coords.lng; }
      const { data } = await api.get("/posts", { params });
      setPosts(data);
    } catch (e) { toast.error(errMsg(e)); }
    setLoading(false);
  }, [f, coords]);

  useEffect(() => { load(); }, [load]);

  return (
    <Shell testId="feed-page">
      <div className="grain relative overflow-hidden rounded-b-[2rem] bg-forest px-5 pb-6 pt-8 text-white">
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-honey">Makanan di sekitarmu</p>
              <h1 className="mt-1 font-heading text-3xl font-black leading-tight tracking-tight">
                Hai {user?.name?.split(" ")[0]},<br />ada apa hari ini?
              </h1>
            </div>
            <button data-testid="feed-inbox-btn" onClick={() => navigate("/inbox")} className="press rounded-full bg-white/15 p-2.5">
              <Bell size={20} weight="fill" />
            </button>
          </div>
          {user?.role === "admin" && (
            <button data-testid="admin-link" onClick={() => navigate("/admin")} className="press mt-3 flex items-center gap-1.5 rounded-full bg-honey px-3 py-1.5 text-xs font-extrabold text-ink">
              <ShieldCheck size={14} weight="fill" /> Panel Admin
            </button>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-30 -mt-3 bg-sand/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
            {cats.map((c) => (
              <button
                key={c.k} data-testid={`filter-cat-${c.k || "all"}`} onClick={() => setF({ ...f, category: c.k })}
                className={`press whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold ${f.category === c.k ? "bg-ink text-white" : "border border-line bg-white text-slate2"}`}
              >{c.t}</button>
            ))}
          </div>
          <button data-testid="filter-toggle-btn" onClick={() => setShowFilter(!showFilter)} className="press rounded-full border border-line bg-white p-2.5 text-forest">
            <SlidersHorizontal size={18} weight="bold" />
          </button>
        </div>

        {showFilter && (
          <div data-testid="filter-panel" className="mt-3 space-y-3 rounded-3xl border border-line bg-white p-4 shadow-warm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate2">Radius</p>
              <div className="mt-2 flex gap-2">
                {radii.map((r) => (
                  <button key={r.v} data-testid={`filter-radius-${r.v}`} onClick={() => setF({ ...f, radius_km: r.v })}
                    className={`press flex-1 rounded-full py-2 text-xs font-extrabold ${f.radius_km === r.v ? "bg-clay text-white" : "bg-sand text-slate2"}`}>{r.t}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate2">Cara serah terima</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {handoffs.map((h) => (
                  <button key={h.k} data-testid={`filter-handoff-${h.k || "all"}`} onClick={() => setF({ ...f, handoff: h.k })}
                    className={`press rounded-full py-2 text-xs font-extrabold ${f.handoff === h.k ? "bg-forest text-white" : "bg-sand text-slate2"}`}>{h.t}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 pt-2">
        {loading && [0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/70" />)}
        {!loading && posts.length === 0 && (
          <div data-testid="feed-empty" className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center">
            <p className="font-heading text-lg font-extrabold text-ink">Belum ada yang bagi</p>
            <p className="mt-1 text-sm text-slate2">Coba perluas radius, atau kamu yang mulai bagi duluan.</p>
            <button data-testid="empty-post-btn" onClick={() => navigate("/post")} className="press mt-4 rounded-full bg-clay px-5 py-2.5 text-sm font-extrabold text-white">Bagi makanan</button>
          </div>
        )}
        {posts.map((p, i) => <SurplusCard key={p.id} post={p} index={i} />)}
      </div>
    </Shell>
  );
}
