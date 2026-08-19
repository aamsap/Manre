import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { House, PlusCircle, ChatCircleDots, User, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const items = [
  { to: "/feed", label: "Feed", icon: House, testId: "side-nav-feed" },
  { to: "/inbox", label: "Inbox", icon: ChatCircleDots, testId: "side-nav-inbox" },
  { to: "/profile", label: "Profil", icon: User, testId: "side-nav-profile" },
];

export const SideNav = ({ unread = 0 }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <aside data-testid="side-nav" className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white px-5 py-8 md:flex">
      <button onClick={() => navigate("/feed")} className="press text-left">
        <span className="font-heading text-2xl font-black tracking-tight text-forest">Manre</span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate2">
          Bagi makanan yuk
        </span>
      </button>

      <button
        data-testid="side-nav-post"
        onClick={() => navigate("/post")}
        className="press mt-8 flex items-center justify-center gap-2 rounded-full bg-clay py-3.5 font-heading text-sm font-extrabold text-white shadow-warm hover:bg-clay-dark"
      >
        <PlusCircle size={20} weight="fill" /> Bagi makanan
      </button>

      <nav className="mt-6 flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, testId }) => (
          <NavLink key={to} to={to} data-testid={testId}
            className={({ isActive }) =>
              `press flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition-colors ${
                isActive ? "bg-forest text-white" : "text-slate2 hover:bg-sand"}`}>
            {({ isActive }) => (
              <>
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                {label}
                {label === "Inbox" && unread > 0 && (
                  <span data-testid="side-inbox-badge" className="ml-auto rounded-full bg-clay px-2 py-0.5 text-[10px] font-extrabold text-white">
                    {unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink to="/admin" data-testid="side-nav-admin"
            className={({ isActive }) =>
              `press flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold ${
                isActive ? "bg-ink text-white" : "text-slate2 hover:bg-sand"}`}>
            <ShieldCheck size={20} weight="fill" /> Admin
          </NavLink>
        )}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line p-3">
        {user?.picture
          ? <img src={user.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
          : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-heading text-sm font-extrabold text-white">{user?.name?.[0]}</span>}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate2">Trust {user?.trust_score}</p>
        </div>
      </div>
    </aside>
  );
};
