import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SignOut, ShieldCheck, ThumbsUp, ThumbsDown, Package, FileText } from "@phosphor-icons/react";
import { Shell } from "@/components/layout/Shell";
import { api, errMsg, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Countdown } from "@/components/Countdown";

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const [myPosts, setMyPosts] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/posts", { params: { mine: true } });
      setMyPosts(data);
      refresh();
    } catch (e) { toast.error(errMsg(e)); }
  }, [refresh]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <Shell testId="profile-page">
      <div className="grain relative overflow-hidden rounded-b-[2rem] bg-forest px-5 pb-8 pt-10 text-white">
        <div className="relative z-10 flex items-center gap-4">
          {user.picture
            ? <img src={user.picture} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-white/25" />
            : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-honey font-heading text-2xl font-black text-ink">{user.name?.[0]}</div>}
          <div>
            <h1 data-testid="profile-name" className="font-heading text-2xl font-black leading-tight tracking-tight">{user.name}</h1>
            <p className="text-xs text-white/70">{user.email}</p>
            <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${user.location_set ? "bg-honey text-ink" : "bg-white/20 text-white"}`}>
              <ShieldCheck size={12} weight="fill" /> {user.location_set ? "Lokasi tersimpan" : "Lokasi belum diatur"}
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-3 gap-2">
          <Stat label="Trust score" value={user.trust_score} testId="trust-score" />
          <Stat label="Serah terima" value={user.handoffs || 0} testId="handoff-count" />
          <Stat label="Porsi dibagi" value={user.portions_shared || 0} testId="portions-shared" />
        </div>
        <div className="relative z-10 mt-2 flex gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5"><ThumbsUp size={13} weight="fill" /> {user.thumbs_up || 0}</span>
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5"><ThumbsDown size={13} weight="fill" /> {user.thumbs_down || 0}</span>
          {(user.no_shows?.length || 0) > 0 && <span className="rounded-full bg-clay px-3 py-1.5">{user.no_shows.length} no-show / 30 hari</span>}
        </div>
      </div>

      <div className="px-5 pt-6">
        {user.role === "admin" && (
          <button data-testid="profile-admin-btn" onClick={() => navigate("/admin")} className="press mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-honey py-3.5 font-heading font-extrabold text-ink">
            <ShieldCheck size={18} weight="fill" /> Panel Admin
          </button>
        )}

        <h2 className="font-heading text-lg font-extrabold text-ink">Postku</h2>
        <div className="mt-3 space-y-3">
          {myPosts.length === 0 && (
            <div data-testid="myposts-empty" className="rounded-3xl border border-dashed border-line bg-white/60 p-6 text-center text-sm text-slate2">
              Belum pernah bagi makanan. Yuk mulai!
            </div>
          )}
          {myPosts.map((p) => (
            <button key={p.id} data-testid={`myposts-${p.id}`} onClick={() => navigate(`/post/${p.id}`)}
              className="press flex w-full items-center gap-3 rounded-3xl border border-line bg-white p-3 text-left shadow-warm">
              <img src={mediaUrl(p.photo_url)} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-extrabold text-ink">{p.title}</p>
                <p className="flex items-center gap-1 text-xs text-slate2"><Package size={12} weight="fill" /> {p.portions} {p.unit} · {p.status}</p>
              </div>
              {p.status === "available" && <Countdown target={p.window_end} testId={`myposts-countdown-${p.id}`} />}
            </button>
          ))}
        </div>

        <button data-testid="terms-btn" onClick={() => navigate("/terms")} className="press mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3 text-sm font-bold text-slate2">
          <FileText size={16} weight="fill" /> Syarat & Ketentuan
        </button>
        <button data-testid="logout-btn" onClick={async () => { await logout(); navigate("/"); }}
          className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-heading font-extrabold text-white">
          <SignOut size={18} weight="fill" /> Keluar
        </button>
      </div>
    </Shell>
  );
}

const Stat = ({ label, value, testId }) => (
  <div className="rounded-2xl bg-white/12 p-3 text-center">
    <p data-testid={testId} className="font-heading text-2xl font-black tabular-nums">{value}</p>
    <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">{label}</p>
  </div>
);
