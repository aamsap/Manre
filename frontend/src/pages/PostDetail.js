import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Package, Clock, MapPin, Truck, Handshake, Flag, Trash, ChatCircleDots } from "@phosphor-icons/react";
import { Countdown } from "@/components/Countdown";
import { MiniMap } from "@/components/MiniMap";
import { api, errMsg, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
const handoffMeta = {
  pickup: { label: "Ambil di lokasi donor", icon: Handshake },
  dropoff: { label: "Titik netral", icon: MapPin },
  delivery: { label: "Diantar donor", icon: Truck },
};
const fmt = (s) => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState("Dijual ulang / komersial");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/posts/${id}`);
      setPost(data);
    } catch (e) { toast.error(errMsg(e)); navigate("/feed"); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  if (!post) return <div className="min-h-screen bg-sand" data-testid="post-detail-loading" />;

  const H = handoffMeta[post.handoff];
  const mine = post.donor_id === user?.user_id;
  const claim = post.active_claim;
  const iClaimed = claim && claim.recipient_id === user?.user_id;

  const doClaim = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${id}/claim`, { recipient_ack: true, note: "" });
      toast.success("Slot terkunci 15 menit. Tunggu donor konfirmasi!");
      navigate(`/chat/${data.id}`);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const doReport = async () => {
    try {
      await api.post("/reports", { target_type: "post", target_id: id, reason, detail: "" });
      toast.success("Laporan terkirim ke admin");
      setShowReport(false);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/posts/${id}`);
      toast.success("Post dibatalkan");
      navigate("/feed");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand pb-40 shadow-2xl" data-testid="post-detail-page">
        <div className="relative h-72">
          <img src={mediaUrl(post.photo_url)} alt={post.title} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/60 to-transparent" />
          <button data-testid="detail-back-btn" onClick={() => navigate("/feed")} className="press absolute left-4 top-4 rounded-full bg-white/95 p-2.5 text-ink">
            <ArrowLeft size={18} weight="bold" />
          </button>
          <div className="absolute right-4 top-4"><Countdown target={post.window_end} testId="detail-countdown" /></div>
        </div>

        <div className="-mt-6 rounded-t-[2rem] bg-sand px-5 pt-6">
          <span className="rounded-full bg-forest px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
            {post.category === "cooked" ? "Makanan matang" : "Bahan mentah"}
          </span>
          <h1 data-testid="detail-title" className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-ink">{post.title}</h1>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Info icon={Package} label="Jumlah" value={`${post.portions} ${post.unit}`} />
            <Info icon={MapPin} label="Jarak" value={post.distance_m == null ? "—" : post.distance_m < 1000 ? `${post.distance_m} m` : `${(post.distance_m / 1000).toFixed(1)} km`} />
            <Info icon={Clock} label="Jendela ambil" value={`${fmt(post.window_start)} – ${fmt(post.window_end)}`} />
            <Info icon={H.icon} label="Serah terima" value={post.dropoff_name || H.label} />
          </div>

          {post.prep_time && (
            <p className="mt-3 rounded-2xl bg-honey/20 px-4 py-3 text-xs font-semibold text-ink">
              Dimasak: {fmt(post.prep_time)}
            </p>
          )}
          {post.notes && (
            <div className="mt-4 rounded-3xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate2">Catatan kondisi</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{post.notes}</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest font-heading font-extrabold text-white">
              {post.donor?.name?.[0]}
            </div>
            <div className="flex-1">
              <p className="font-heading text-sm font-extrabold text-ink">{post.donor?.name}</p>
              <p className="text-xs text-slate2">Trust {post.donor?.trust_score} · 👍 {post.donor?.thumbs_up} · {post.donor?.handoffs} serah terima</p>
            </div>
          </div>

          <div className="mt-4 h-48 overflow-hidden rounded-3xl border border-line">
            <MiniMap testId="detail-map" lat={post.lat} lng={post.lng} mode={post.privacy_offset ? "circle" : "marker"} />
          </div>
          {post.privacy_offset && <p className="mt-2 text-xs text-slate2">Lokasi persis disamarkan ~100 m untuk privasi donor. Detail dibagikan di chat.</p>}

          <button data-testid="report-btn" onClick={() => setShowReport(true)} className="press mt-4 flex items-center gap-1.5 text-xs font-bold text-clay underline">
            <Flag size={14} weight="fill" /> Laporkan post ini
          </button>
          {mine && (
            <button data-testid="delete-post-btn" onClick={doDelete} className="press mt-3 flex items-center gap-1.5 text-xs font-bold text-slate2 underline">
              <Trash size={14} weight="fill" /> Batalkan post
            </button>
          )}

          {showReport && (
            <div data-testid="report-panel" className="mt-4 space-y-3 rounded-3xl border border-line bg-white p-4">
              <select data-testid="report-reason-select" value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-2xl border border-line bg-sand px-3 py-2.5 text-sm">
                {["Dijual ulang / komersial", "Foto palsu / menipu", "Makanan tidak layak", "Spam", "Lainnya"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <button data-testid="submit-report-btn" onClick={doReport} className="press w-full rounded-full bg-clay py-3 text-sm font-extrabold text-white">Kirim laporan</button>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-line bg-white p-4 shadow-[0_-8px_30px_rgba(44,85,69,0.10)]">
          {mine ? (
            <p data-testid="own-post-note" className="text-center text-sm font-semibold text-slate2">Ini postmu. Lihat klaim masuk di Inbox.</p>
          ) : iClaimed ? (
            <button data-testid="open-chat-btn" onClick={() => navigate(`/chat/${claim.id}`)} className="press flex w-full items-center justify-center gap-2 rounded-full bg-forest py-4 font-heading font-extrabold text-white">
              <ChatCircleDots size={18} weight="fill" /> Buka chat klaim
            </button>
          ) : post.status !== "available" ? (
            <p data-testid="unavailable-note" className="text-center text-sm font-bold text-slate2">
              {post.status === "claimed" ? "Sedang diklaim orang lain" : "Sudah tidak tersedia"}
            </p>
          ) : (
            <>
              <label className="mb-3 flex items-start gap-2.5">
                <input data-testid="recipient-ack-checkbox" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 accent-clay" />
                <span className="text-xs font-semibold leading-snug text-ink">
                  Saya paham makanan ini gratis, non-komersial, dan saya menerima kondisinya.
                </span>
              </label>
              <button data-testid="claim-btn" disabled={!ack || busy} onClick={doClaim}
                className="press w-full rounded-full bg-clay py-4 font-heading font-extrabold text-white shadow-warmlg disabled:opacity-40">
                {busy ? "Mengunci slot..." : "Klaim sekarang"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Info = ({ icon: I, label, value }) => (
  <div className="rounded-2xl border border-line bg-white p-3">
    <I size={16} weight="fill" className="text-clay" />
    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate2">{label}</p>
    <p className="text-sm font-bold leading-tight text-ink">{value}</p>
  </div>
);
