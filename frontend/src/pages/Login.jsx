import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { loginEmail, register } = useAuth();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signin") await loginEmail(email, password);
      else await register(email, password, name || email.split("@")[0]);
      toast.success("Welcome to your journal.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not authenticate");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] grid md:grid-cols-2">
      <div className="hidden md:block relative">
        <img
          src="https://images.unsplash.com/photo-1547104442-991cb31eaafd?auto=format&fit=crop&w=1200&q=80"
          alt="" className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/30" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="font-serif text-3xl text-foreground leading-snug max-w-md">
            &ldquo;Write hard and clear about what hurts.&rdquo;
          </p>
          <p className="mt-3 text-sm text-secondary">— Hemingway</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 md:px-16 py-16">
        <div className="w-full max-w-md rise">
          <h1 className="font-serif text-4xl md:text-5xl mb-2">Welcome back.</h1>
          <p className="text-secondary mb-10">Sign in or create a new journal in seconds.</p>

          <Button
            onClick={handleGoogle}
            variant="outline"
            className="w-full h-12 rounded-full border-border bg-background hover:bg-surface"
            data-testid="google-signin-btn"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="flex items-center my-7">
            <div className="flex-1 h-px bg-border" />
            <span className="px-4 text-xs uppercase tracking-[0.2em] text-secondary">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6 bg-surface">
              <TabsTrigger value="signin" data-testid="tab-signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Sign up</TabsTrigger>
            </TabsList>
            <form onSubmit={submit} className="space-y-4">
              <TabsContent value="signup" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required={tab === "signup"} data-testid="signup-name-input" className="mt-2 bg-surface border-border h-11" />
                </div>
              </TabsContent>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="email-input" className="mt-2 bg-surface border-border h-11" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="password-input" className="mt-2 bg-surface border-border h-11" />
              </div>
              <Button type="submit" className="w-full rounded-full h-11" disabled={busy} data-testid="auth-submit-btn">
                {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create journal"}
              </Button>
            </form>
          </Tabs>

          <p className="text-xs text-secondary mt-8 text-center">
            Try the demo: <span className="font-mono">demo@tanijournal.com</span> / <span className="font-mono">Tani@2026</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.8-5.3l-6.4-5.4C29.4 35 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.4 5.4C41.4 35.6 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
);
