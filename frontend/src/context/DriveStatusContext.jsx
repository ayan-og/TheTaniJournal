import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const DriveStatusContext = createContext(null);

export function DriveStatusProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(null); // null=unknown, false=no, true=yes
  const [connectedAt, setConnectedAt] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setConnected(null);
      setConnectedAt(null);
      return;
    }
    try {
      const { data } = await api.get("/drive/status");
      setConnected(!!data.connected);
      setConnectedAt(data.connected_at || null);
    } catch {
      setConnected(false);
      setConnectedAt(null);
    }
  }, [user]);

  // Single fetch when user changes (mount, login, logout)
  useEffect(() => { refresh(); }, [refresh]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/drive/connect");
      window.location.href = data.authorization_url;
    } finally { setBusy(false); }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await api.delete("/drive/disconnect");
      setConnected(false);
      setConnectedAt(null);
    } finally { setBusy(false); }
  }, []);

  const value = useMemo(
    () => ({ connected, connectedAt, busy, connect, disconnect, refresh }),
    [connected, connectedAt, busy, connect, disconnect, refresh],
  );

  return <DriveStatusContext.Provider value={value}>{children}</DriveStatusContext.Provider>;
}

export const useDriveStatus = () => {
  const ctx = useContext(DriveStatusContext);
  if (!ctx) throw new Error("useDriveStatus must be used inside <DriveStatusProvider>");
  return ctx;
};
