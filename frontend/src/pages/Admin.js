import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Prohibit, ArrowCounterClockwise } from "@phosphor-icons/react";
import { api, errMsg, mediaUrl } from "@/lib/api";

export default function Admin() {
  const [tab, setTab] = useState("review");
  const [stats, setStats] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [s, f, r, u] = await Promise.all([
        api.get("/admin/stats"), api.get("/admin/posts/flagged"),
        api.get("/admin/reports"), api.get("/admin/users"),
      ]);
      setStats(s.data); setFlagged(f.data); setReports(r.data); setUsers(u.data);
    } catch (e) { toast.error(errMsg(e)); navigate("/feed"); }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, decision) => {
    try { await api.post(`/admin/posts/${id}/review?decision=${decision}`); toast.success("Tersimpan"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const ban = async (id, val) => {
    try { await api.post(`/admin/users/${id}/ban?ban=${val}`); toast.success(val ? "User diblokir" : "Blokir dicabut"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const resolve = async (id) => {
    try { await api.post(`/admin/reports/${id}/resolve`); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand pb-12 shadow-2xl" data-testid="admin-page">
        <div className="bg-ink px-5 pb-6 pt-8 text-white">
          <button data-testid="admin-back-btn" onClick={() => navigate("/feed")} className="press flex items-center gap-1 text-sm font-bold text-white/70">
            <ArrowLeft size={16} weight="bold" /> Feed
          </button>
          <h1 className="mt-3 font-heading text-2xl font-black tracking-tight">Panel Admin</h1>
          {stats && (
            <div data-testid="admin-stats" className="mt-4 grid grid-cols-3 gap-2">
              {[["Warga", stats.users], ["Post", stats.posts], ["Aktif", stats.available],
                ["Klaim", stats.claims], ["Selesai %", stats.completion_rate], ["No-show %", stats.no_show_rate]].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-white/10 p-2.5 text-center">
                  <p className="font-heading text-lg font-black tabular-nums">{v}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky top-0 z-20 bg-sand/95 px-5 py-3 backdrop-blur">
          <div className="flex gap-1.5 rounded-full bg-white p-1 shadow-warm">
            {[["review", `Review ${flagged.length}`], ["reports", `Laporan ${reports.filter(r => r.status === "open").length}`], ["users", "Warga"]].map(([k, t]) => (
              <button key={k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)}
                className={`press flex-1 rounded-full py-2 text-[11px] font-extrabold uppercase tracking-wider ${tab === k ? "bg-forest text-white" : "text-slate2"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-5">
          {tab === "review" && (flagged.length === 0
            ? <Empty testId="review-empty" text="Tidak ada post yang perlu ditinjau." />
            : flagged.map((p) => (
              <div key={p.id} data-testid={`review-${p.id}`} className="overflow-hidden rounded-3xl border border-line bg-white shadow-warm">
                <img src={mediaUrl(p.photo_url)} alt="" className="h-36 w-full object-cover" />
                <div className="p-4">
                  <p className="font-heading font-extrabold text-ink">{p.title}</p>
                  <p className="text-xs text-slate2">{p.donor?.name} · {p.portions} {p.unit} · {p.category}</p>
                  <p className="mt-1 text-sm text-slate2">{p.notes}</p>
                  <div className="mt-3 flex gap-2">
                    <button data-testid={`approve-${p.id}`} onClick={() => review(p.id, "approve")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-forest py-2.5 text-xs font-extrabold text-white">
                      <CheckCircle size={15} weight="fill" /> Setujui
                    </button>
                    <button data-testid={`reject-${p.id}`} onClick={() => review(p.id, "reject")} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-clay py-2.5 text-xs font-extrabold text-white">
                      <XCircle size={15} weight="fill" /> Tolak
                    </button>
                  </div>
                </div>
              </div>
            )))}

          {tab === "reports" && (reports.length === 0
            ? <Empty testId="reports-empty" text="Belum ada laporan." />
            : reports.map((r) => (
              <div key={r.id} data-testid={`report-${r.id}`} className="rounded-3xl border border-line bg-white p-4 shadow-warm">
                <p className="font-heading text-sm font-extrabold text-ink">{r.reason}</p>
                <p className="text-xs text-slate2">{r.target_type} · {r.target_id?.slice(0, 8)} · oleh {r.reporter_name}</p>
                {r.detail && <p className="mt-1 text-sm text-slate2">{r.detail}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${r.status === "open" ? "bg-honey/40 text-ink" : "bg-line text-slate2"}`}>{r.status}</span>
                  {r.status === "open" && (
                    <button data-testid={`resolve-${r.id}`} onClick={() => resolve(r.id)} className="press ml-auto rounded-full bg-forest px-4 py-2 text-xs font-extrabold text-white">Tandai selesai</button>
                  )}
                </div>
              </div>
            )))}

          {tab === "users" && users.map((u) => (
            <div key={u.user_id} data-testid={`admin-user-${u.user_id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3 shadow-warm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand font-heading font-extrabold text-forest">{u.name?.[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-extrabold text-ink">{u.name} {u.role === "admin" && "· admin"}</p>
                <p className="truncate text-xs text-slate2">{u.email} · trust {u.trust_score}</p>
              </div>
              {u.is_banned
                ? <button data-testid={`unban-${u.user_id}`} onClick={() => ban(u.user_id, false)} className="press rounded-full bg-forest p-2.5 text-white"><ArrowCounterClockwise size={16} weight="bold" /></button>
                : <button data-testid={`ban-${u.user_id}`} onClick={() => ban(u.user_id, true)} className="press rounded-full bg-clay p-2.5 text-white"><Prohibit size={16} weight="bold" /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const Empty = ({ text, testId }) => (
  <div data-testid={testId} className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-slate2">{text}</div>
);
