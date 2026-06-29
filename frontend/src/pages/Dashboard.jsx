import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { PenLine, Lock, Globe2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/posts/mine");
      setItems(data.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    try {
      await api.delete(`/posts/${id}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
      toast.success("Entry deleted");
    } catch (e) { toast.error("Could not delete"); }
  };

  const publicCount = items.filter((p) => p.visibility === "public").length;
  const privateCount = items.length - publicCount;

  return (
    <div className="px-6 md:px-12 py-12 md:py-16 mx-auto max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 rise">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">Your shelf</p>
          <h1 className="font-serif text-4xl sm:text-5xl">Hello, {user?.name?.split(" ")[0] || "writer"}.</h1>
          <p className="mt-3 text-secondary">{items.length} entries · {publicCount} public · {privateCount} private</p>
        </div>
        <Button onClick={() => navigate("/editor")} className="rounded-full h-11 px-6" data-testid="dashboard-new-btn">
          <PenLine className="h-4 w-4 mr-2" /> New entry
        </Button>
      </div>

      {loading ? (
        <p className="text-secondary py-20 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-24 surface rounded-2xl border border-border" data-testid="dashboard-empty">
          <p className="font-serif text-2xl mb-3">A blank page is waiting.</p>
          <p className="text-secondary mb-6">Write your first entry — public or private.</p>
          <Button onClick={() => navigate("/editor")} className="rounded-full">Begin</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p, i) => (
            <li
              key={p.id}
              className={`group rounded-xl border border-border hover:border-primary/30 transition-colors p-5 md:p-6 flex items-center gap-5 rise rise-${Math.min(i + 1, 5)}`}
              data-testid={`dashboard-entry-${p.id}`}
            >
              <span title={p.visibility} className="shrink-0 h-9 w-9 rounded-full surface flex items-center justify-center text-secondary">
                {p.visibility === "public" ? <Globe2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <Link to={`/post/${p.id}`} className="flex-1 min-w-0">
                <div className="font-serif text-xl truncate">{p.title}</div>
                <div className="text-xs text-secondary mt-1">
                  {new Date(p.created_at).toLocaleDateString()} · {p.tags?.slice(0, 3).join(" · ") || "no tags"}
                </div>
              </Link>
              <div className="hidden sm:flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/editor/${p.id}`)} data-testid={`edit-${p.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid={`delete-${p.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif text-2xl">Delete this entry?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(p.id)} data-testid={`delete-confirm-${p.id}`}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
