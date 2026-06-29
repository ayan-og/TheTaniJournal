import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/login"); return; }
    const sessionId = match[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        if (data.session_token) localStorage.setItem("tani_session_token", data.session_token);
        setUser(data.user);
        // Strip hash and redirect to dashboard
        window.history.replaceState({}, "", window.location.pathname);
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-secondary text-sm" data-testid="auth-callback-loading">
      Signing you in…
    </div>
  );
}
