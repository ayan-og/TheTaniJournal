// Backward-compatible re-export. The real implementation lives in
// /app/frontend/src/context/DriveStatusContext.jsx so Navbar + Editor (+ future
// components) share a single /drive/status fetch instead of one per mount.
export { useDriveStatus } from "@/context/DriveStatusContext";
