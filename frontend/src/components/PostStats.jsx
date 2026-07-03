import React, { useState, useEffect } from "react";
import { Heart, Eye } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function PostStats({ postId, initialLikes = 0, initialViews = 0, isLiked = false }) {
  const { user } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [views, setViews] = useState(initialViews);
  const [liked, setLiked] = useState(isLiked);
  const [loading, setLoading] = useState(false);

  // Record view on component mount
  useEffect(() => {
    api.post(`/posts/${postId}/view`).catch(() => {});
  }, [postId]);

  const toggleLike = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to like posts");
      return;
    }

    setLoading(true);
    try {
      if (liked) {
        await api.delete(`/posts/${postId}/like`);
        setLikes(Math.max(0, likes - 1));
        setLiked(false);
      } else {
        await api.post(`/posts/${postId}/like`);
        setLikes(likes + 1);
        setLiked(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update like");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-6 text-sm text-secondary">
      <button
        onClick={toggleLike}
        disabled={loading}
        className={`flex items-center gap-2 transition-colors ${
          liked ? "text-red-500" : "hover:text-foreground"
        }`}
        data-testid="post-like-btn"
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} />
        <span>{likes}</span>
      </button>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>{views}</span>
      </div>
    </div>
  );
}
