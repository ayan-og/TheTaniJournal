import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AvatarWithDot from "@/components/AvatarWithDot";
import PostCard from "@/components/PostCard";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { userId } = useParams();
  const { user: me, setUser: setMe } = useAuth();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [err, setErr] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    try {
      const [u, p] = await Promise.all([
        api.get(`/users/${userId}`).then(({ data }) => data),
        api.get(`/users/${userId}/posts`).then(({ data }) => data.items || []),
      ]);
      setUser(u);
      setPosts(p);
    } catch {
      setErr("Could not load profile");
    }
  };

  useEffect(() => { load(); }, [userId]);

  if (err) return <div className="px-6 py-20 text-center text-secondary">{err}</div>;
  if (!user) return <div className="px-6 py-20 text-center text-secondary">Loading…</div>;

  const isMe = me && me.user_id === user.user_id;

  return (
    <div className="px-6 md:px-12 py-12 md:py-16 mx-auto max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-center gap-8 mb-16 rise">
        <AvatarWithDot user={user} userId={user.user_id} size={96} online={isMe ? true : undefined} />
        <div className="flex-1">
          <h1 className="font-serif text-4xl sm:text-5xl mb-2" data-testid="profile-name">{user.name}</h1>
          <p className="text-secondary text-sm">{user.email}</p>
          {user.bio && <p className="mt-4 text-base text-foreground/90 max-w-2xl leading-relaxed" data-testid="profile-bio">{user.bio}</p>}
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-secondary">
            Joined {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </p>
        </div>
        {isMe && (
          <Button variant="outline" onClick={() => setEditOpen(true)} className="rounded-full self-start md:self-auto" data-testid="profile-edit-btn">
            <Pencil className="h-4 w-4 mr-2" /> Edit profile
          </Button>
        )}
      </header>

      <h2 className="font-serif text-2xl mb-8">Public entries <span className="text-secondary text-base">({posts.length})</span></h2>

      {posts.length === 0 ? (
        <p className="text-secondary py-12 text-center" data-testid="profile-no-posts">No public entries yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map((p, i) => <PostCard key={p.id} post={p} index={i % 5} />)}
        </div>
      )}

      {isMe && (
        <ProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={user}
          onSaved={(updated) => { setUser(updated); setMe(updated); }}
        />
      )}
    </div>
  );
}
