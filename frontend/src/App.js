import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthCallback from "@/pages/AuthCallback";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Feed from "@/pages/Feed";
import PostCreate from "@/pages/PostCreate";
import PostDetail from "@/pages/PostDetail";
import Inbox from "@/pages/Inbox";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Terms from "@/pages/Terms";

const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-sand" data-testid="app-loading">
    <div className="h-12 w-12 animate-pulse rounded-full bg-clay" />
  </div>
);

function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/feed" replace />;
  if (!user.onboarded && !admin) return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/feed" element={<Protected><Feed /></Protected>} />
      <Route path="/post" element={<Protected><PostCreate /></Protected>} />
      <Route path="/post/:id" element={<Protected><PostDetail /></Protected>} />
      <Route path="/inbox" element={<Protected><Inbox /></Protected>} />
      <Route path="/chat/:claimId" element={<Protected><Chat /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
