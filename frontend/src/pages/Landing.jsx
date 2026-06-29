import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Sparkles, Users } from "lucide-react";
import PostCard from "@/components/PostCard";

export default function Landing() {
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    api.get("/posts?limit=3").then(({ data }) => setRecent(data.items || [])).catch(() => {});
  }, []);

  return (
    <div className="grain">
      {/* Hero */}
      <section className="px-6 md:px-12 pt-16 md:pt-28 pb-20 md:pb-28 mx-auto max-w-6xl">
        <div className="grid md:grid-cols-12 gap-12 items-end">
          <div className="md:col-span-7 rise">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-6" data-testid="landing-eyebrow">
              A quiet place to write
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-foreground">
              Write what you<br />
              cannot say aloud.
            </h1>
            <p className="mt-8 text-lg text-secondary max-w-lg leading-relaxed font-sans">
              The Tani Journal is a slow, considered space for private journals and public reflections. Bring your mornings, your rainy afternoons, your half-formed ideas.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/login"><Button size="lg" className="rounded-full px-7 h-12" data-testid="landing-cta-start">Start writing<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link to="/feed"><Button variant="outline" size="lg" className="rounded-full px-7 h-12 border-border" data-testid="landing-cta-explore">Explore journals</Button></Link>
            </div>
          </div>
          <div className="md:col-span-5 rise rise-2">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden border border-border surface">
              <img
                src="https://images.unsplash.com/photo-1606997875311-857add95bca0?auto=format&fit=crop&w=900&q=80"
                alt="Open notebook"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section className="px-6 md:px-12 pb-24 mx-auto max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          <Feature icon={<BookOpen className="h-5 w-5" />} title="Yours, privately" body="Mark entries private and they stay yours alone. Public posts find readers when you're ready." />
          <Feature icon={<Users className="h-5 w-5" />} title="Quiet community" body="Read essays from other writers. Leave a comment. Report what doesn't belong." />
          <Feature icon={<Sparkles className="h-5 w-5" />} title="Live presence" body="A small blue dot tells you when a writer is present. Pre-internet warmth, modern stack." />
        </div>
      </section>

      {/* Recent posts */}
      {recent.length > 0 && (
        <section className="px-6 md:px-12 pb-28 mx-auto max-w-6xl">
          <div className="flex items-baseline justify-between mb-10">
            <h2 className="font-serif text-3xl md:text-4xl">From the community</h2>
            <Link to="/feed" className="text-sm text-secondary hover:text-foreground" data-testid="landing-view-all">View all →</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {recent.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
          </div>
        </section>
      )}

      <footer className="border-t border-border py-10 text-center text-sm text-secondary px-6">
        Built slowly. Written carefully. © {new Date().getFullYear()} The Tani Journal.
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="rounded-2xl border border-border p-7 surface hover:-translate-y-0.5 transition-all">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5">{icon}</div>
      <h3 className="font-serif text-xl mb-2">{title}</h3>
      <p className="text-sm text-secondary leading-relaxed">{body}</p>
    </div>
  );
}
