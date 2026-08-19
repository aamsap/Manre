import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    (async () => {
      try {
        const { data } = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sessionId } });
        if (data.token) localStorage.setItem("manre_token", data.token);
        setUser(data.user);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(data.user.onboarded ? "/feed" : "/onboarding", { replace: true, state: { user: data.user } });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [location.hash, navigate, setUser]);

  return <div className="min-h-screen bg-sand" data-testid="auth-callback" />;
}
