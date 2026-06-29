import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Check, X } from "lucide-react";

export default function DriveCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const processed = useRef(false);
  const [state, setState] = useState({ status: "working", msg: "Connecting to Google Drive…" });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState({ status: "error", msg: "Please sign in first" });
      setTimeout(() => navigate("/login"), 1500);
      return;
    }
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");
    const errParam = params.get("error");

    if (errParam || !code) {
      setState({ status: "error", msg: errParam ? `Google returned: ${errParam}` : "Authorization cancelled" });
      setTimeout(() => navigate("/dashboard"), 1800);
      return;
    }

    api.post("/drive/callback", { code, state: stateParam })
      .then(() => {
        setState({ status: "ok", msg: "Drive connected. Redirecting…" });
        setTimeout(() => navigate("/dashboard?drive=connected"), 1100);
      })
      .catch((e) => {
        setState({ status: "error", msg: e.response?.data?.detail || "Connection failed" });
        setTimeout(() => navigate("/dashboard"), 2000);
      });
  }, [loading, user, navigate]);

  const Icon = state.status === "ok" ? Check : state.status === "error" ? X : Loader2;
  const color = state.status === "ok" ? "text-primary" : state.status === "error" ? "text-destructive" : "text-secondary";

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6" data-testid="drive-callback-page">
      <Icon className={`h-10 w-10 mb-6 ${color} ${state.status === "working" ? "animate-spin" : ""}`} />
      <p className="font-serif text-2xl text-center max-w-md" data-testid="drive-callback-msg">{state.msg}</p>
    </div>
  );
}
