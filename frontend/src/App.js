import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Feed from "@/pages/Feed";
import PostView from "@/pages/PostView";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import Profile from "@/pages/Profile";

function AppShell() {
  const location = useLocation();
  // CRITICAL: detect OAuth callback synchronously during render to avoid race conditions
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-64px)]">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/post/:id" element={<PostView />} />
          <Route path="/u/:userId" element={<Profile />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
          <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
          <Toaster position="bottom-right" toastOptions={{ className: "font-sans" }} />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
