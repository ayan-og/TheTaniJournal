import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AvatarWithDot from "@/components/AvatarWithDot";
import PostCard from "@/components/PostCard";

export default function Profile() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/users/${userId}`).then(({ data }) => setUser(data)),
      api.get(`/users/${userId}/posts`).then(({ data }) => setPosts(data.items || [])),
    ]).catch(() => setErr("Could not load profile"));
  }, [userId]);

  if (err) return <div className="px-6 py-20 text-center text-secondary">{err}</div>;
  if (!user) return <div className="px-6 py-20 text-center text-secondary">Loading…</div>;

  return (
    <div className="px-6 md:px-12 py-12 md:py-16 mx-auto max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-center gap-8 mb-16 rise">
        <AvatarWithDot user={user} userId={user.user_id} size={96} />
        <div>
          <h1 className="font-serif text-4xl sm:text-5xl mb-2" data-testid="profile-name">{user.name}</h1>
          <p className="text-secondary text-sm">{user.email}</p>
          {user.bio && <p className="mt-4 text-base text-foreground/90 max-w-2xl leading-relaxed">{user.bio}</p>}
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-secondary">
            Joined {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </p>
        </div>
      </header>

      <h2 className="font-serif text-2xl mb-8">Public entries <span className="text-secondary text-base">({posts.length})</span></h2>

      {posts.length === 0 ? (
        <p className="text-secondary py-12 text-center" data-testid="profile-no-posts">No public entries yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map((p, i) => <PostCard key={p.id} post={p} index={i % 5} />)}
        </div>
      )}
    </div>
  );
}
