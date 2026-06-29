import React from "react";
import { Link } from "react-router-dom";
import AvatarWithDot from "@/components/AvatarWithDot";
import { Lock } from "lucide-react";

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function PostCard({ post, index = 0, showVisibility = false }) {
  const author = post.author || {};
  const isPrivate = post.visibility === "private";
  return (
    <Link
      to={`/post/${post.id}`}
      data-testid={`post-card-${post.id}`}
      className={`block rounded-2xl border border-border bg-card hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 p-6 md:p-8 rise rise-${Math.min(index + 1, 5)}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <AvatarWithDot user={author} userId={author.user_id} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-sans text-foreground truncate">{author.name || "Anonymous"}</div>
          <div className="text-xs text-secondary">{timeAgo(post.created_at)}</div>
        </div>
        {showVisibility && isPrivate && (
          <span className="flex items-center gap-1 text-xs text-secondary uppercase tracking-widest">
            <Lock className="h-3 w-3" /> Private
          </span>
        )}
      </div>

      <h3 className="font-serif text-2xl md:text-3xl leading-tight mb-3 text-foreground">{post.title}</h3>
      <p className="text-secondary text-base leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>

      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-xs uppercase tracking-[0.18em] text-secondary border border-border rounded-full px-3 py-1">
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
