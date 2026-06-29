import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip /me — AuthCallback handles it.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  // Heartbeat presence every 30s
  useEffect(() => {
    if (!user) return;
    const beat = () => api.post("/presence/heartbeat").catch(() => {});
    beat();
    const id = setInterval(beat, 30000);
    return () => clearInterval(id);
  }, [user]);

  const loginEmail = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.session_token) localStorage.setItem("tani_session_token", data.session_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    if (data.session_token) localStorage.setItem("tani_session_token", data.session_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("tani_session_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginEmail, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
