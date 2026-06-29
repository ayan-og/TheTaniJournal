import React, { useEffect, useState } from "react";
import api from "@/lib/api";

/** Avatar with presence dot. Pass `online` bool, or `userId` to auto-fetch. */
export default function AvatarWithDot({ user, online = null, size = 40, userId = null, autoFetch = true }) {
  const [isOnline, setIsOnline] = useState(online);
  const initials = (user?.name || user?.email || "T").trim().slice(0, 1).toUpperCase();
  const uid = userId || user?.user_id;

  useEffect(() => {
    if (online !== null) { setIsOnline(online); return; }
    if (!autoFetch || !uid) return;
    let alive = true;
    api.get(`/presence/status?user_ids=${uid}`).then(({ data }) => {
      if (alive) setIsOnline(!!data?.online?.[uid]);
    }).catch(() => {});
    return () => { alive = false; };
  }, [uid, online, autoFetch]);

  const dotSize = Math.max(8, Math.round(size * 0.28));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} data-testid={`avatar-${uid || "anon"}`}>
      {user?.picture ? (
        <img src={user.picture} alt={user.name || "user"} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="flex items-center justify-center w-full h-full rounded-full bg-primary/15 text-primary font-medium font-sans" style={{ fontSize: size * 0.42 }}>
          {initials}
        </span>
      )}
      <span
        data-testid={`presence-dot-${uid || "anon"}-${isOnline ? "online" : "offline"}`}
        className="absolute rounded-full ring-2 ring-background"
        style={{
          width: dotSize, height: dotSize, right: -2, bottom: -2,
          background: isOnline ? "hsl(var(--online))" : "hsl(var(--offline))",
        }}
        title={isOnline ? "Online" : "Offline"}
      />
    </span>
  );
}
