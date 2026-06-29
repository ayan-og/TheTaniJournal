import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AvatarWithDot from "@/components/AvatarWithDot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function ReportButton({ targetType, targetId, label = "Report" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return toast.error("Please describe the issue");
    setBusy(true);
    try {
      const url = targetType === "post" ? `/posts/${targetId}/report` : `/comments/${targetId}/report`;
      await api.post(url, { reason });
      toast.success("Thanks — we'll review this report.");
      setOpen(false); setReason("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not send report");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid={`report-${targetType}-${targetId}`} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-destructive">
          <Flag className="h-3 w-3" /> {label}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">Report this {targetType}</DialogTitle></DialogHeader>
        <Input
          placeholder="Reason (spam, harassment, off-topic…)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          data-testid="report-reason-input"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} data-testid="report-submit-btn">Send report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CommentSection({ postId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/posts/${postId}/comments`);
      setItems(data.items || []);
    } catch {
      /* silent: keep previous items */
    }
  };
  useEffect(() => { load(); }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${postId}/comments`, { content: text });
      setItems((prev) => [...prev, data]);
      setText("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not post comment");
    } finally { setBusy(false); }
  };

  return (
    <section className="reading-width mt-16" data-testid="comments-section">
      <h3 className="font-serif text-2xl mb-6">Conversation <span className="text-secondary text-base">({items.length})</span></h3>

      {user ? (
        <div className="flex gap-3 mb-10">
          <AvatarWithDot user={user} userId={user.user_id} size={36} online />
          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share a thought…"
              className="min-h-[80px] rounded-xl bg-surface border-border"
              data-testid="comment-input"
            />
            <div className="flex justify-end mt-2">
              <Button onClick={submit} disabled={busy || !text.trim()} className="rounded-full" data-testid="comment-submit-btn">
                Post comment
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-secondary mb-10 text-sm">Sign in to join the conversation.</p>
      )}

      <ul className="space-y-8">
        {items.map((c) => (
          <li key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
            <AvatarWithDot user={c.author} userId={c.author?.user_id} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-sans text-sm">{c.author?.name || "Anonymous"}</span>
                <span className="text-xs text-secondary">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1 text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.content}</p>
              {user && user.user_id !== c.author_id && (
                <div className="mt-1"><ReportButton targetType="comment" targetId={c.id} /></div>
              )}
            </div>
          </li>
        ))}
        {!items.length && <li className="text-secondary text-sm">Be the first to leave a thought.</li>}
      </ul>
    </section>
  );
}

export { ReportButton };
