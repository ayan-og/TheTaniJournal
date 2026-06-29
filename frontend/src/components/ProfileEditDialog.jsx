import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ProfileEditDialog({ open, onOpenChange, user, onSaved }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [picture, setPicture] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user || !open) return;
    setName(user.name || "");
    setBio(user.bio || "");
    setPicture(user.picture || "");
  }, [user, open]);

  const uploadAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image");
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const { data } = await api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      setPicture(`${BACKEND_URL}${data.url}`);
      toast.success("Avatar ready");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/users/me", { name, bio, picture: picture || null });
      onSaved?.(data);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="profile-edit-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit your profile</DialogTitle>
          <DialogDescription>Tell readers a little about yourself.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full overflow-hidden surface border border-border flex items-center justify-center text-2xl font-serif">
              {picture ? (
                <img src={picture} alt="avatar preview" className="w-full h-full object-cover" />
              ) : (
                (name || "T").slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={uploadAvatar}
                hidden
                data-testid="profile-avatar-file-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                data-testid="profile-avatar-upload-btn"
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading…" : "Upload avatar"}
              </Button>
              {picture && (
                <button
                  type="button"
                  onClick={() => setPicture("")}
                  className="ml-3 text-xs text-secondary hover:text-destructive"
                  data-testid="profile-avatar-remove-btn"
                >Remove</button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="pe-name">Name</Label>
            <Input id="pe-name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-2 bg-surface border-border h-11" data-testid="profile-name-input" />
          </div>

          <div>
            <Label htmlFor="pe-bio">Bio</Label>
            <Textarea id="pe-bio" value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Curator of quiet thoughts…"
              maxLength={280}
              className="mt-2 bg-surface border-border min-h-[90px]" data-testid="profile-bio-input" />
            <div className="text-xs text-secondary mt-1 text-right">{bio.length}/280</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="profile-edit-cancel">Cancel</Button>
          <Button onClick={save} disabled={busy} className="rounded-full" data-testid="profile-edit-save">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
