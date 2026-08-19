import React, { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

export function useCountdown(target) {
  const [ms, setMs] = useState(() => new Date(target).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setMs(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return ms;
}

export const Countdown = ({ target, testId }) => {
  const ms = useCountdown(target);
  const expired = ms <= 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const urgent = !expired && ms < 2 * 3600000;
  const label = expired ? "Kadaluarsa" : h >= 24 ? `${Math.floor(h / 24)}h ${h % 24}j lagi` : h > 0 ? `${h}j ${pad(m)}m lagi` : `${pad(m)}:${pad(s)} lagi`;

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
        expired ? "bg-ink/80 text-white" : urgent ? "bg-clay text-white animate-pulse-ring" : "bg-leaf text-white"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
      {label}
    </span>
  );
};
