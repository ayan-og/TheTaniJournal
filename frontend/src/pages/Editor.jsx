import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import RichEditor from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Globe2, Lock, HardDrive, Upload, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { useDriveStatus } from "@/hooks/useDriveStatus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { connected: driveConnected } = useDriveStatus();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [layout, setLayout] = useState("single");
  const [isExplicit, setIsExplicit] = useState(false);
  const [is18Plus, setIs18Plus] = useState(false);
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!id) return;
    api.get(`/posts/${id}`).then(({ data }) => {
      setTitle(data.title); 
      setContent(data.content);
      setTags((data.tags || []).join(", "));
      setIsPublic(data.visibility === "public");
      setLayout(data.layout || "single");
      setIsExplicit(data.is_explicit || false);
      setIs18Plus(data.is_18_plus || false);
      setMedia(data.media || []);
    }).catch(() => toast.error("Could not load entry"));
  }, [id]);

  const stripHtml = (s) => s.replace(/<[^>]+>/g, "").trim();

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMedia((prev) => [...prev, data.path]);
      }
      toast.success(`Uploaded ${files.length} file(s)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (path) => {
    setMedia((prev) => prev.filter((p) => p !== path));
  };

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
        media,
        layout,
        is_explicit: isExplicit,
        is_18_plus: is18Plus,
      };
      let savedId;
      if (isEdit) {
        await api.put(`/posts/${id}`, payload);
        savedId = id;
        toast.success("Entry updated");
      } else {
        const { data } = await api.post("/posts", payload);
        savedId = data.id;
        toast.success("Entry published");
      }
      // Auto-sync to Drive if connected (fire-and-forget; main save already succeeded)
      if (driveConnected && savedId) {
        api.post(`/posts/${savedId}/export-drive`)
          .then(() => toast.success("Also synced to your Google Drive"))
          .catch(() => { /* silent — local save succeeded */ });
      }
      navigate(`/post/${savedId}`);
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

          <div>
            <Label htmlFor="layout" className="text-xs uppercase tracking-[0.2em] text-secondary">Media Layout</Label>
            <Select value={layout} onValueChange={setLayout}>
              <SelectTrigger id="layout" className="mt-2 bg-surface border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single (Full Width)</SelectItem>
                <SelectItem value="grid">Grid (Multiple Items)</SelectItem>
                <SelectItem value="carousel">Carousel (Scrollable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-secondary">Media Files</Label>
            <div className="mt-2 space-y-2">
              {media.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {media.map((path) => (
                    <div key={path} className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs">
                      <span className="truncate flex-1">{path.split("/").pop()}</span>
                      <button onClick={() => removeMedia(path)} className="text-secondary hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-4 w-4" />
                <span className="text-sm">Upload images, audio, or video…</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*"
                  onChange={handleMediaUpload}
                  disabled={uploading}
                  className="hidden"
                  data-testid="editor-media-upload"
                />
              </label>
            </div>
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

          <div className="space-y-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isExplicit}
                onChange={(e) => setIsExplicit(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Contains explicit content</span>
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">18+ content (mature audiences only)</span>
            </Label>
            {(isExplicit || is18Plus) && (
              <div className="flex items-start gap-2 pt-2 text-xs text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>Readers will see a content warning before viewing your post.</p>
              </div>
            )}
          </div>

          {driveConnected && (
            <div
              className="flex items-center gap-3 text-xs text-secondary px-2"
              data-testid="editor-drive-sync-hint"
            >
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              This entry will also be saved to your Google Drive on publish.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => navigate(-1)} data-testid="editor-cancel-btn">Cancel</Button>
            <Button onClick={save} disabled={busy || uploading} className="rounded-full px-7 h-11" data-testid="editor-save-btn">
              {busy ? "Saving…" : uploading ? "Uploading…" : isEdit ? "Save changes" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
                </div>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} data-testid="editor-visibility-toggle" />
          </div>

          {driveConnected && (
            <div
              className="flex items-center gap-3 text-xs text-secondary px-2"
              data-testid="editor-drive-sync-hint"
            >
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              This entry will also be saved to your Google Drive on publish.
            </div>
          )}

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
