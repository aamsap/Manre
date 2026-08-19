import React, { useEffect, useState } from "react";
import { BottomNav } from "./BottomNav";
import { api } from "@/lib/api";

export const Shell = ({ children, nav = true, testId }) => {
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
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div
        data-testid={testId}
        className={`relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-sand shadow-2xl ${nav ? "pb-28" : ""}`}
      >
        {children}
        {nav && <BottomNav unread={unread} />}
      </div>
    </div>
  );
};
