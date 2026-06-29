import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu, X, PenLine, HardDrive } from "lucide-react";
import AvatarWithDot from "@/components/AvatarWithDot";
import { useDriveStatus } from "@/hooks/useDriveStatus";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NavLink = ({ to, children, testId, onClick }) => {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      onClick={onClick}
      data-testid={testId}
      className={`text-sm font-sans tracking-wide transition-colors hover:text-foreground ${active ? "text-foreground" : "text-secondary"}`}
    >
      {children}
    </Link>
  );
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { connected: driveConnected, connect: connectDrive, disconnect: disconnectDrive, busy: driveBusy } = useDriveStatus(user);
  const [open, setOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const navigate = useNavigate();

  const confirmDisconnect = async () => {
    await disconnectDrive();
    setDisconnectOpen(false);
    toast.success("Google Drive disconnected");
  };

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 glass border-b border-border">
      <div className="mx-auto max-w-6xl px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <span className="font-serif text-2xl tracking-tight">The Tani Journal</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/feed" testId="nav-feed">Feed</NavLink>
          {user && <NavLink to="/dashboard" testId="nav-dashboard">My Journal</NavLink>}
          {user && <NavLink to={`/u/${user.user_id}`} testId="nav-profile">Profile</NavLink>}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <Button onClick={() => navigate("/editor")} className="rounded-full" data-testid="nav-write-btn">
                <PenLine className="h-4 w-4 mr-2" /> Write
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="nav-user-menu" className="rounded-full focus:outline-none">
                    <AvatarWithDot user={user} userId={user.user_id} size={36} online />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-sans">
                    <div className="text-sm">{user.name}</div>
                    <div className="text-xs text-secondary truncate">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} data-testid="menu-dashboard">My Journal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/u/${user.user_id}`)} data-testid="menu-profile">Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {driveConnected ? (
                    <DropdownMenuItem
                      onSelect={() => { setTimeout(() => setDisconnectOpen(true), 0); }}
                      data-testid="menu-drive-disconnect"
                    >
                      <HardDrive className="h-4 w-4 mr-2 text-primary" /> Drive connected · disconnect
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={connectDrive} disabled={driveBusy} data-testid="menu-drive-connect">
                      <HardDrive className="h-4 w-4 mr-2" /> Connect Google Drive
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="menu-logout">Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => navigate("/login")} className="rounded-full" data-testid="nav-login-btn">Sign in</Button>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setOpen(!open)}
          data-testid="mobile-menu-toggle"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background" data-testid="mobile-menu">
          <div className="px-6 py-6 flex flex-col gap-5">
            <NavLink to="/feed" testId="m-nav-feed" onClick={close}>Feed</NavLink>
            {user && <NavLink to="/dashboard" testId="m-nav-dashboard" onClick={close}>My Journal</NavLink>}
            {user && <NavLink to={`/u/${user.user_id}`} testId="m-nav-profile" onClick={close}>Profile</NavLink>}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="ghost" size="icon" onClick={toggle} data-testid="m-theme-toggle">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user ? (
                <>
                  <Button onClick={() => { close(); navigate("/editor"); }} className="rounded-full" data-testid="m-nav-write">
                    <PenLine className="h-4 w-4 mr-2" /> Write
                  </Button>
                  <Button variant="outline" onClick={async () => { close(); await logout(); navigate("/"); }} className="rounded-full" data-testid="m-nav-logout">
                    Sign out
                  </Button>
                </>
              ) : (
                <Button onClick={() => { close(); navigate("/login"); }} className="rounded-full" data-testid="m-nav-login">Sign in</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">Disconnect Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              Your existing exported files will stay safely in your Drive. We&apos;ll just stop syncing new entries until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="drive-disconnect-cancel">Keep connected</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} disabled={driveBusy} data-testid="drive-disconnect-confirm">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
