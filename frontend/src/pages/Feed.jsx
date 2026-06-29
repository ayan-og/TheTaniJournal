import React, { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import PostCard from "@/components/PostCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function Feed() {
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 9;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (activeTag) params.set("tag", activeTag);
      params.set("page", reset ? 1 : page);
      params.set("limit", limit);
      const { data } = await api.get(`/posts?${params}`);
      setTotal(data.total || 0);
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      if (reset) setPage(2); else setPage((p) => p + 1);
    } finally { setLoading(false); }
  }, [q, activeTag, page]);

  useEffect(() => { api.get("/posts/tags").then(({ data }) => setTags(data.tags || [])).catch(() => {}); }, []);

  useEffect(() => {
    setItems([]); setPage(1);
    const t = setTimeout(() => load(true), 250);
    return () => clearTimeout(t);
  }, [q, activeTag]);

  const hasMore = items.length < total;

  return (
    <div className="px-6 md:px-12 py-12 md:py-16 mx-auto max-w-6xl">
      <div className="mb-12 rise">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-4">The community</p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Public journals</h1>
        <p className="mt-4 text-secondary max-w-xl">A slow scroll through what other writers are thinking about today.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            data-testid="feed-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts, themes, tags…"
            className="pl-11 h-12 rounded-full bg-surface border-border"
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-12">
          <button
            data-testid="filter-tag-all"
            onClick={() => setActiveTag(null)}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.18em] border transition-all ${!activeTag ? "bg-primary text-primary-foreground border-primary" : "border-border text-secondary hover:text-foreground"}`}
          >All</button>
          {tags.map((t) => (
            <button
              key={t.name}
              data-testid={`filter-tag-${t.name}`}
              onClick={() => setActiveTag(t.name === activeTag ? null : t.name)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.18em] border transition-all ${activeTag === t.name ? "bg-primary text-primary-foreground border-primary" : "border-border text-secondary hover:text-foreground"}`}
            >{t.name}</button>
          ))}
        </div>
      )}

      {items.length === 0 && !loading && (
        <p className="text-secondary py-20 text-center" data-testid="feed-empty">No journals match your search.</p>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((p, i) => <PostCard key={p.id} post={p} index={i % 5} />)}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            data-testid="feed-load-more"
            onClick={() => load(false)}
            disabled={loading}
            className="px-7 py-3 rounded-full border border-border text-sm hover:bg-surface transition-colors"
          >{loading ? "Loading…" : "Load more"}</button>
        </div>
      )}
    </div>
  );
}
