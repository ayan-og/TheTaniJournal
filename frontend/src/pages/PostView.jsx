import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import api from "@/lib/api";
import AvatarWithDot from "@/components/AvatarWithDot";
import CommentSection, { ReportButton } from "@/components/CommentSection";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/posts/${id}`).then(({ data }) => setPost(data)).catch((e) => setErr(e.response?.data?.detail || "Could not load post"));
  }, [id]);

  const safeContent = useMemo(
    () => DOMPurify.sanitize(post?.content || "", {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "blockquote", "h1", "h2", "h3", "ol", "ul", "li", "a", "code", "pre", "img", "hr"],
      ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    }),
    [post?.content],
  );

  if (err) return <div className="px-6 py-20 text-center text-secondary" data-testid="post-error">{err}</div>;
  if (!post) return <div className="px-6 py-20 text-center text-secondary">Loading…</div>;

  const isOwner = user && user.user_id === post.author_id;
  const created = new Date(post.created_at);

  const remove = async () => {
    try {
      await api.delete(`/posts/${id}`);
      toast.success("Post deleted");
      navigate("/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not delete");
    }
  };

  return (
    <article className="px-6 md:px-12 py-12 md:py-16">
      <div className="reading-width">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground mb-10" data-testid="post-back">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {post.visibility === "private" && (
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-secondary mb-6">
            <Lock className="h-3 w-3" /> Private entry
          </div>
        )}

        <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight mb-6 rise" data-testid="post-title">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 mb-12 rise rise-1">
          <Link to={`/u/${post.author?.user_id}`}>
            <AvatarWithDot user={post.author} userId={post.author?.user_id} size={40} />
          </Link>
          <div className="flex-1">
            <Link to={`/u/${post.author?.user_id}`} className="font-sans text-sm hover:underline" data-testid="post-author-link">
              {post.author?.name}
            </Link>
            <div className="text-xs text-secondary">{created.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>

          {isOwner ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/editor/${post.id}`)} data-testid="post-edit-btn">
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid="post-delete-btn">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-2xl">Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone. All comments will be removed too.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove} data-testid="post-delete-confirm">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            user && <ReportButton targetType="post" targetId={post.id} />
          )}
        </div>

        <div className="prose-journal rise rise-2" dangerouslySetInnerHTML={{ __html: safeContent }} data-testid="post-content" />

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12">
            {post.tags.map((t) => (
              <span key={t} className="text-xs uppercase tracking-[0.18em] text-secondary border border-border rounded-full px-3 py-1">{t}</span>
            ))}
          </div>
        )}
      </div>

      {post.visibility === "public" && <CommentSection postId={post.id} />}
    </article>
  );
}
