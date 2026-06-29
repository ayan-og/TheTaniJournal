import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import RichEditor from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Globe2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!id) return;
    api.get(`/posts/${id}`).then(({ data }) => {
      setTitle(data.title); setContent(data.content);
      setTags((data.tags || []).join(", "));
      setIsPublic(data.visibility === "public");
    }).catch(() => toast.error("Could not load entry"));
  }, [id]);

  const stripHtml = (s) => s.replace(/<[^>]+>/g, "").trim();

  const save = async () => {
    if (!title.trim()) return toast.error("Give your entry a title");
    if (!stripHtml(content)) return toast.error("Your page is still blank");
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        content,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility: isPublic ? "public" : "private",
        excerpt: stripHtml(content).slice(0, 200),
      };
      if (isEdit) {
        await api.put(`/posts/${id}`, payload);
        toast.success("Entry updated");
        navigate(`/post/${id}`);
      } else {
        const { data } = await api.post("/posts", payload);
        toast.success("Entry published");
        navigate(`/post/${data.id}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save");
    } finally { setBusy(false); }
  };

  return (
    <div className="px-6 md:px-12 py-12 md:py-16">
      <div className="reading-width">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-6">{isEdit ? "Editing entry" : "New entry"}</p>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A title for your entry…"
          className="border-0 border-b border-border rounded-none px-0 bg-transparent font-serif text-4xl md:text-5xl h-auto py-3 focus-visible:ring-0 focus-visible:border-primary"
          data-testid="editor-title-input"
        />

        <div className="mt-4">
          <RichEditor value={content} onChange={setContent} />
        </div>

        <div className="mt-10 space-y-6 pt-8 border-t border-border">
          <div>
            <Label htmlFor="tags" className="text-xs uppercase tracking-[0.2em] text-secondary">Tags</Label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, themes"
              className="mt-2 bg-surface border-border h-11" data-testid="editor-tags-input" />
          </div>

          <div className="flex items-center justify-between p-5 rounded-xl border border-border surface">
            <div className="flex items-start gap-3">
              {isPublic ? <Globe2 className="h-5 w-5 text-primary mt-0.5" /> : <Lock className="h-5 w-5 text-secondary mt-0.5" />}
              <div>
                <div className="font-sans text-sm">{isPublic ? "Public entry" : "Private entry"}</div>
                <div className="text-xs text-secondary mt-1">
                  {isPublic ? "Visible to the community. Others can read and comment." : "Only you can see this entry."}
                </div>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} data-testid="editor-visibility-toggle" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => navigate(-1)} data-testid="editor-cancel-btn">Cancel</Button>
            <Button onClick={save} disabled={busy} className="rounded-full px-7 h-11" data-testid="editor-save-btn">
              {busy ? "Saving…" : isEdit ? "Save changes" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
