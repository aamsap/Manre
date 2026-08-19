import React, { useEffect, useState } from "react";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { api } from "@/lib/api";

export const Shell = ({ children, nav = true, testId, wide = false }) => {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!nav) return;
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (alive) setUnread(data.filter((n) => !n.read).length);
      } catch { /* noop */ }
    };
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [nav]);

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0] md:flex">
      {nav && <SideNav unread={unread} />}
      <div className="flex-1">
        <div
          data-testid={testId}
          className={`relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-sand shadow-2xl md:max-w-none md:bg-transparent md:shadow-none ${
            nav ? "pb-28 md:pb-10" : ""
          }`}
        >
          <div className={`md:mx-auto md:w-full ${wide ? "md:max-w-6xl" : "md:max-w-3xl"} md:px-8 md:py-8`}>
            {children}
          </div>
          {nav && <div className="md:hidden"><BottomNav unread={unread} /></div>}
        </div>
      </div>
    </div>
  );
};
