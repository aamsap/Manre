import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ChatCircleDots, BellRinging } from "@phosphor-icons/react";
import { Shell } from "@/components/layout/Shell";
import { api, errMsg, mediaUrl } from "@/lib/api";

const statusMeta = {
  pending: { t: "Menunggu konfirmasi", c: "bg-honey/30 text-ink" },
  accepted: { t: "Diterima", c: "bg-leaf/20 text-forest" },
  completed: { t: "Selesai", c: "bg-forest text-white" },
  rejected: { t: "Ditolak", c: "bg-line text-slate2" },
  cancelled: { t: "Dibatalkan", c: "bg-line text-slate2" },
  expired: { t: "Slot hangus", c: "bg-line text-slate2" },
  no_show: { t: "No-show", c: "bg-clay text-white" },
};

export default function Inbox() {
  const [tab, setTab] = useState("claims");
  const [claims, setClaims] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([api.get("/claims"), api.get("/notifications")]);
      setClaims(c.data);
      setNotifs(n.data);
    } catch (e) { toast.error(errMsg(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async () => {
    await api.post("/notifications/read");
    load();
  };

  return (
    <Shell testId="inbox-page">
      <div className="px-5 pb-4 pt-8">
        <h1 className="font-heading text-3xl font-black tracking-tight text-ink">Inbox</h1>
        <div className="mt-4 flex gap-2 rounded-full bg-white p-1 shadow-warm">
          {[{ k: "claims", t: "Klaim" }, { k: "notif", t: "Notifikasi" }].map((x) => (
            <button key={x.k} data-testid={`inbox-tab-${x.k}`} onClick={() => setTab(x.k)}
              className={`press flex-1 rounded-full py-2.5 text-xs font-extrabold uppercase tracking-widest ${tab === x.k ? "bg-forest text-white" : "text-slate2"}`}>
              {x.t}
            </button>
          ))}
        </div>
      </div>

      {tab === "claims" ? (
        <div className="space-y-3 px-5">
          {claims.length === 0 && <Empty text="Belum ada klaim. Coba klaim makanan di feed!" testId="claims-empty" />}
          {claims.map((c, i) => {
            const m = statusMeta[c.status] || statusMeta.pending;
            return (
              <motion.button key={c.id} data-testid={`claim-row-${c.id}`} onClick={() => navigate(`/chat/${c.id}`)}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="press flex w-full items-center gap-3 rounded-3xl border border-line bg-white p-3 text-left shadow-warm">
                <img src={mediaUrl(c.post_photo)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-extrabold text-ink">{c.post_title}</p>
                  <p className="text-xs text-slate2">{c.my_role === "donor" ? "Penerima" : "Donor"}: {c.other_party?.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${m.c}`}>{m.t}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ChatCircleDots size={20} weight="fill" className="text-forest" />
                  {c.unread > 0 && <span className="rounded-full bg-clay px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {notifs.some((n) => !n.read) && (
            <button data-testid="mark-read-btn" onClick={markRead} className="press ml-auto block text-xs font-bold text-clay underline">Tandai semua terbaca</button>
          )}
          {notifs.length === 0 && <Empty text="Belum ada notifikasi." testId="notifs-empty" />}
          {notifs.map((n) => (
            <button key={n.id} data-testid={`notif-${n.id}`} onClick={() => n.link && navigate(n.link)}
              className={`press flex w-full gap-3 rounded-3xl border p-4 text-left ${n.read ? "border-line bg-white/60" : "border-clay/40 bg-white shadow-warm"}`}>
              <BellRinging size={20} weight="fill" className={n.read ? "text-slate2" : "text-clay"} />
              <div>
                <p className="font-heading text-sm font-extrabold text-ink">{n.title}</p>
                <p className="text-xs leading-snug text-slate2">{n.body}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate2">
                  {new Date(n.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

const Empty = ({ text, testId }) => (
  <div data-testid={testId} className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-slate2">{text}</div>
);
