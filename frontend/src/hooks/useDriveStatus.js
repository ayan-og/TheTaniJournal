import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

/** Single source of truth for Google Drive connection status of the current user. */
export function useDriveStatus(user) {
  const [connected, setConnected] = useState(null); // null = unknown, false = no, true = yes
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setConnected(null); return; }
    try {
      const { data } = await api.get("/drive/status");
      setConnected(!!data.connected);
    } catch {
      setConnected(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/drive/connect");
      window.location.href = data.authorization_url;
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.delete("/drive/disconnect");
      setConnected(false);
    } finally { setBusy(false); }
  };

  return { connected, busy, connect, disconnect, refresh };
}
