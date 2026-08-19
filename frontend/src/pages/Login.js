import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GoogleLogo, ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { loginPassword, register } = useAuth();
  const navigate = useNavigate();

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/feed";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = mode === "login"
        ? await loginPassword(form.email, form.password)
        : await register(form.name, form.email, form.password);
      toast.success(`Halo, ${u.name}!`);
      navigate(u.onboarded ? "/feed" : "/onboarding");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand px-6 pb-12 pt-8 shadow-2xl md:my-10 md:min-h-0 md:max-w-md md:rounded-[2rem] md:py-10" data-testid="login-page">
        <button data-testid="back-btn" onClick={() => navigate("/")} className="press mb-6 flex items-center gap-1 text-sm font-bold text-slate2">
          <ArrowLeft size={16} weight="bold" /> Kembali
        </button>

        <h1 className="font-heading text-3xl font-black tracking-tight text-ink">
          {mode === "login" ? "Masuk dulu ya" : "Gabung Manre"}
        </h1>
        <p className="mt-2 text-sm text-slate2">
          Buat berbagi & klaim makanan di sekitar UB Malang.
        </p>

        <button
          data-testid="google-login-btn"
          onClick={googleLogin}
          className="press mt-7 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-4 font-heading font-extrabold text-ink shadow-warm"
        >
          <GoogleLogo size={20} weight="bold" className="text-clay" /> Lanjut dengan Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate2">atau email</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              data-testid="name-input" required placeholder="Nama panggilan"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-clay"
            />
          )}
          <input
            data-testid="email-input" required type="email" placeholder="Email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-clay"
          />
          <input
            data-testid="password-input" required type="password" minLength={8} placeholder="Password (min 8 karakter)"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-clay"
          />
          <button
            data-testid="submit-auth-btn" disabled={busy} type="submit"
            className="press w-full rounded-full bg-forest py-4 font-heading font-extrabold text-white shadow-warmlg disabled:opacity-60"
          >
            {busy ? "Sebentar..." : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <button
          data-testid="toggle-mode-btn"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mx-auto mt-5 block text-sm font-semibold text-clay underline"
        >
          {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </div>
    </div>
  );
}
