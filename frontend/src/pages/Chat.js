import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, PaperPlaneRight, ThumbsUp, ThumbsDown, CheckCircle, XCircle, UserMinus } from "@phosphor-icons/react";
import { api, errMsg, mediaUrl, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Countdown } from "@/components/Countdown";

export default function Chat() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [claim, setClaim] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [rated, setRated] = useState(false);
  const [note, setNote] = useState("");
  const endRef = useRef();

  const load = useCallback(async () => {
    try {
      const [c, m, r] = await Promise.all([
        api.get(`/claims/${claimId}`),
        api.get(`/claims/${claimId}/messages`),
        api.get(`/claims/${claimId}/rating-mine`),
      ]);
      setClaim(c.data); setMsgs(m.data); setRated(r.data.rated);
    } catch (e) { toast.error(errMsg(e)); navigate("/inbox"); }
  }, [claimId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const wsUrl = API.replace(/^http/, "ws") + `/ws/chat/${claimId}`;
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        setMsgs((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      };
    } catch { /* noop */ }
    return () => ws?.close();
  }, [claimId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      const { data } = await api.post(`/claims/${claimId}/messages`, { text: t });
      setMsgs((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
    } catch (err) { toast.error(errMsg(err)); }
  };

  const act = async (path, okMsg) => {
    try {
      await api.post(`/claims/${claimId}/${path}`);
      toast.success(okMsg);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const rate = async (thumbs) => {
    try {
      await api.post(`/claims/${claimId}/rate`, { thumbs, note });
      toast.success("Terima kasih ratingnya!");
      setRated(true);
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!claim) return <div className="min-h-screen bg-sand" data-testid="chat-loading" />;

  const isDonor = claim.my_role === "donor";
  const myDone = isDonor ? claim.donor_done : claim.recipient_done;
  const active = claim.status === "pending" || claim.status === "accepted";

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-sand shadow-2xl md:my-8 md:max-h-[88vh] md:min-h-0 md:max-w-2xl md:overflow-hidden md:rounded-[2rem]" data-testid="chat-page">
        <div className="sticky top-0 z-20 border-b border-line bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button data-testid="chat-back-btn" onClick={() => navigate("/inbox")} className="press text-ink"><ArrowLeft size={20} weight="bold" /></button>
            <img src={mediaUrl(claim.post_photo)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-extrabold text-ink">{claim.post_title}</p>
              <p className="text-xs text-slate2">{isDonor ? "Penerima" : "Donor"}: {claim.other_party?.name} · trust {claim.other_party?.trust_score}</p>
            </div>
          </div>

          {claim.status === "pending" && (
            <div data-testid="pending-banner" className="mt-3 flex items-center justify-between rounded-2xl bg-honey/25 px-3 py-2">
              <span className="text-xs font-bold text-ink">Slot terkunci</span>
              <Countdown target={claim.lock_expires_at} testId="lock-countdown" />
            </div>
          )}

          {isDonor && claim.status === "pending" && (
            <div className="mt-2 flex gap-2">
              <button data-testid="accept-claim-btn" onClick={() => act("accept", "Klaim diterima")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-forest py-2.5 text-xs font-extrabold text-white">
                <CheckCircle size={15} weight="fill" /> Terima
              </button>
              <button data-testid="reject-claim-btn" onClick={() => act("reject", "Klaim ditolak")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-white py-2.5 text-xs font-extrabold text-slate2">
                <XCircle size={15} weight="fill" /> Tolak
              </button>
            </div>
          )}
          {!isDonor && active && (
            <button data-testid="cancel-claim-btn" onClick={() => act("cancel", "Klaim dibatalkan")} className="press mt-2 w-full rounded-full border border-line bg-white py-2 text-xs font-extrabold text-slate2">
              Batalkan klaim
            </button>
          )}
          {isDonor && claim.status === "accepted" && (
            <button data-testid="no-show-btn" onClick={() => act("no-show", "No-show dilaporkan")} className="press mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-clay/40 bg-white py-2 text-xs font-extrabold text-clay">
              <UserMinus size={14} weight="fill" /> Lapor penerima tidak datang
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 pb-4">
          {msgs.length === 0 && (
            <p data-testid="chat-empty" className="mx-auto max-w-[80%] rounded-2xl bg-white/70 p-3 text-center text-xs text-slate2">
              Mulai chat buat atur waktu & titik serah terima. Jangan bagikan info pribadi berlebih ya.
            </p>
          )}
          {msgs.map((m) => {
            const me = m.sender_id === user?.user_id;
            return (
              <div key={m.id} data-testid={`msg-${m.id}`} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${me ? "rounded-br-md bg-forest text-white" : "rounded-bl-md border border-line bg-white text-ink"}`}>
                  {m.text}
                  <span className={`mt-1 block text-[10px] ${me ? "text-white/70" : "text-slate2"}`}>
                    {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-0 border-t border-line bg-white p-3">
          {claim.status === "completed" && !rated ? (
            <div data-testid="rating-panel" className="space-y-2">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-slate2">Kasih rating {isDonor ? "penerima" : "donor"}</p>
              <input data-testid="rating-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)"
                className="w-full rounded-2xl border border-line bg-sand px-3.5 py-2.5 text-sm outline-none" />
              <div className="flex gap-2">
                <button data-testid="thumbs-up-btn" onClick={() => rate("up")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-leaf py-3 text-sm font-extrabold text-white">
                  <ThumbsUp size={16} weight="fill" /> Bagus
                </button>
                <button data-testid="thumbs-down-btn" onClick={() => rate("down")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-clay py-3 text-sm font-extrabold text-white">
                  <ThumbsDown size={16} weight="fill" /> Kurang
                </button>
              </div>
            </div>
          ) : claim.status === "completed" ? (
            <p data-testid="completed-note" className="py-2 text-center text-sm font-bold text-forest">Serah terima selesai. Makasih sudah berbagi!</p>
          ) : (
            <>
              {active && (
                <button data-testid="done-btn" disabled={myDone} onClick={() => act("done", myDone ? "" : "Menunggu konfirmasi pihak lain")}
                  className="press mb-2 w-full rounded-full bg-clay py-3 text-sm font-extrabold text-white disabled:opacity-50">
                  {myDone ? "Kamu sudah tap Selesai — tunggu pihak lain" : "Selesai (serah terima beres)"}
                </button>
              )}
              <form onSubmit={send} className="flex items-center gap-2">
                <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..."
                  className="flex-1 rounded-full border border-line bg-sand px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-clay" />
                <button data-testid="chat-send-btn" type="submit" className="press rounded-full bg-forest p-3 text-white">
                  <PaperPlaneRight size={18} weight="fill" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
