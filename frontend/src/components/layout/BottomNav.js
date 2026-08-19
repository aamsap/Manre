import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { House, PlusCircle, ChatCircleDots, User } from "@phosphor-icons/react";

const items = [
  { to: "/feed", label: "Feed", icon: House, testId: "nav-feed" },
  { to: "/inbox", label: "Inbox", icon: ChatCircleDots, testId: "nav-inbox" },
  { to: "/profile", label: "Profil", icon: User, testId: "nav-profile" },
];

export const BottomNav = ({ unread = 0 }) => {
  const navigate = useNavigate();
  return (
    <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-line bg-white px-2 pb-2 pt-2 shadow-[0_-8px_30px_rgba(44,85,69,0.10)]">
      <div className="flex items-end justify-between">
        <NavItem {...items[0]} />
        <button
          data-testid="nav-post"
          onClick={() => navigate("/post")}
          className="press -mt-8 flex flex-col items-center"
          aria-label="Bagi makanan"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay text-white shadow-warmlg ring-4 ring-white">
            <PlusCircle size={30} weight="fill" />
          </span>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-clay">Bagi</span>
        </button>
        <div className="relative">
          <NavItem {...items[1]} />
          {unread > 0 && (
            <span data-testid="inbox-badge" className="absolute right-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>
        <NavItem {...items[2]} />
      </div>
    </div>
  );
};

const NavItem = ({ to, label, icon: Icon, testId }) => (
  <NavLink to={to} data-testid={testId} className="press flex w-16 flex-col items-center gap-0.5 py-1">
    {({ isActive }) => (
      <>
        <Icon size={24} weight={isActive ? "fill" : "regular"} className={isActive ? "text-forest" : "text-slate2"} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-forest" : "text-slate2"}`}>{label}</span>
      </>
    )}
  </NavLink>
);
