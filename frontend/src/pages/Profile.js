import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SignOut, ShieldCheck, ThumbsUp, ThumbsDown, Package, FileText, BellRinging, BellSlash, Flame, Scales, Trophy } from "@phosphor-icons/react";
import { Shell } from "@/components/layout/Shell";
import { api, errMsg, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Countdown } from "@/components/Countdown";
import { currentPushState, enablePush, disablePush } from "@/lib/push";

const badges = (u) => {
  const out = [];
  const h = u.handoffs || 0;
  if (h >= 1) out.push({ t: "Pemula Baik", d: "1 serah terima" });
  if (h >= 5) out.push({ t: "Tetangga Andalan", d: "5 serah terima" });
  if (h >= 20) out.push({ t: "Pahlawan Pangan", d: "20 serah terima" });
  if ((u.kg_shared || 0) >= 10) out.push({ t: "10 kg Diselamatkan", d: "berat total" });
  if ((u.post_streak_days || 0) >= 3) out.push({ t: "Rajin Posting", d: "3 hari berturut" });
  if ((u.handoff_streak_weeks || 0) >= 2) out.push({ t: "Konsisten Mingguan", d: "2 minggu berturut" });
  return out;
};

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const [myPosts, setMyPosts] = useState([]);
  const [pushState, setPushState] = useState("off");
  const [pushBusy, setPushBusy] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/posts", { params: { mine: true } });
      setMyPosts(data);
      refresh();
    } catch (e) { toast.error(errMsg(e)); }
  }, [refresh]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { currentPushState().then(setPushState); }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushState === "on") {
        await disablePush();
        setPushState("off");
        toast.success("Notifikasi dimatikan");
      } else {
        await enablePush();
        setPushState("on");
        await api.post("/push/test");
        toast.success("Notifikasi aktif — cek notif percobaan");
      }
    } catch (e) { toast.error(e.message || errMsg(e)); setPushState(await currentPushState()); }
    setPushBusy(false);
  };

  if (!user) return null;
  const myBadges = badges(user);

  return (
    <Shell testId="profile-page">
      <div className="grain relative overflow-hidden rounded-b-[2rem] bg-forest px-5 pb-8 pt-10 text-white md:rounded-[2rem] md:px-8">
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

        <div className="relative z-10 mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Trust score" value={user.trust_score} testId="trust-score" />
          <Stat label="Serah terima" value={user.handoffs || 0} testId="handoff-count" />
          <Stat label="Porsi dibagi" value={user.portions_shared || 0} testId="portions-shared" />
          <Stat label="Kg diselamatkan" value={user.kg_shared || 0} testId="kg-shared" />
        </div>

        <div className="relative z-10 mt-2 grid grid-cols-2 gap-2">
          <div data-testid="post-streak" className="flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-2.5">
            <Flame size={20} weight="fill" className="text-honey" />
            <div>
              <p className="font-heading text-lg font-black leading-none">{user.post_streak_days || 0} hari</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Streak posting</p>
            </div>
          </div>
          <div data-testid="handoff-streak" className="flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-2.5">
            <Trophy size={20} weight="fill" className="text-honey" />
            <div>
              <p className="font-heading text-lg font-black leading-none">{user.handoff_streak_weeks || 0} minggu</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Streak berbagi</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-2 flex flex-wrap gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5"><ThumbsUp size={13} weight="fill" /> {user.thumbs_up || 0}</span>
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5"><ThumbsDown size={13} weight="fill" /> {user.thumbs_down || 0}</span>
          {(user.no_shows?.length || 0) > 0 && <span className="rounded-full bg-clay px-3 py-1.5">{user.no_shows.length} no-show / 30 hari</span>}
        </div>
      </div>

      <div className="px-5 pt-6 md:px-0">
        <div className="md:grid md:grid-cols-2 md:gap-6">
          <div>
            <h2 className="font-heading text-lg font-extrabold text-ink">Lencana</h2>
            <div data-testid="badges" className="mt-3 flex flex-wrap gap-2">
              {myBadges.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-sm text-slate2">
                  Belum ada lencana. Selesaikan 1 serah terima buat lencana pertamamu.
                </p>
              )}
              {myBadges.map((b) => (
                <span key={b.t} data-testid={`badge-${b.t}`} className="rounded-2xl border border-line bg-white px-3 py-2 shadow-warm">
                  <span className="block font-heading text-xs font-extrabold text-ink">{b.t}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate2">{b.d}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 md:mt-0">
            <h2 className="font-heading text-lg font-extrabold text-ink">Notifikasi perangkat</h2>
            <button data-testid="push-toggle-btn" onClick={togglePush}
              disabled={pushBusy || pushState === "unsupported" || pushState === "denied"}
              className={`press mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-heading font-extrabold disabled:opacity-50 ${
                pushState === "on" ? "border border-line bg-white text-slate2" : "bg-forest text-white"}`}>
              {pushState === "on" ? <BellSlash size={18} weight="fill" /> : <BellRinging size={18} weight="fill" />}
              {pushState === "unsupported" ? "Tidak didukung browser ini"
                : pushState === "denied" ? "Izin notifikasi diblokir"
                : pushState === "on" ? "Matikan notifikasi" : "Nyalakan notifikasi"}
            </button>
            <p className="mt-2 text-xs text-slate2">
              Dapat kabar klaim & pesan baru walau aplikasi sedang tertutup.
            </p>
          </div>
        </div>

        {user.role === "admin" && (
          <button data-testid="profile-admin-btn" onClick={() => navigate("/admin")} className="press mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-honey py-3.5 font-heading font-extrabold text-ink">
            <ShieldCheck size={18} weight="fill" /> Panel Admin
          </button>
        )}

        <h2 className="mt-8 font-heading text-lg font-extrabold text-ink">Postku</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {myPosts.length === 0 && (
            <div data-testid="myposts-empty" className="rounded-3xl border border-dashed border-line bg-white/60 p-6 text-center text-sm text-slate2 md:col-span-2">
              Belum pernah bagi makanan. Yuk mulai!
            </div>
          )}
          {myPosts.map((p) => (
            <button key={p.id} data-testid={`myposts-${p.id}`} onClick={() => navigate(`/post/${p.id}`)}
              className="press flex w-full items-center gap-3 rounded-3xl border border-line bg-white p-3 text-left shadow-warm">
              <img src={mediaUrl(p.photo_url)} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-extrabold text-ink">{p.title}</p>
                <p className="flex items-center gap-1 text-xs text-slate2">
                  <Package size={12} weight="fill" /> {p.portions} {p.unit}
                  {p.weight_kg > 0 && <><Scales size={12} weight="fill" /> ±{p.weight_kg} kg</>} · {p.status}
                </p>
              </div>
              {p.status === "available" && <Countdown target={p.window_end} testId={`myposts-countdown-${p.id}`} />}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 md:max-w-sm">
          <button data-testid="terms-btn" onClick={() => navigate("/terms")} className="press flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3 text-sm font-bold text-slate2">
            <FileText size={16} weight="fill" /> Syarat & Ketentuan
          </button>
          <button data-testid="logout-btn" onClick={async () => { await logout(); navigate("/"); }}
            className="press flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-heading font-extrabold text-white">
            <SignOut size={18} weight="fill" /> Keluar
          </button>
        </div>
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
