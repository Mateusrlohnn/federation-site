"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { postFromRow, type Post } from "@/lib/posts";
import { PostCard, type Vote } from "./shared";

const VOTES_KEY = "feedVotes"; // { [postId]: 'like' | 'dislike' }

function readVotes(): Record<string, Vote> {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function FeedClient({
  initialPosts,
  pageSize,
}: {
  initialPosts: Post[];
  pageSize: number;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [now, setNow] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<string, Vote>>({});

  const [hasMore, setHasMore] = useState(initialPosts.length >= pageSize);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // init client-only (Date/localStorage não existem no SSR)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    setVotes(readVotes());
  }, []);

  async function react(postId: string, kind: "like" | "dislike") {
    if (!supabaseEnabled) return;
    const current = votes[postId] ?? null;
    const next: Vote = current === kind ? null : kind;

    // deltas para a contagem agregada conforme a transição de voto
    let dLike = 0;
    let dDislike = 0;
    if (current === "like") dLike -= 1;
    if (current === "dislike") dDislike -= 1;
    if (next === "like") dLike += 1;
    if (next === "dislike") dDislike += 1;
    if (dLike === 0 && dDislike === 0) return;

    // otimista: atualiza UI antes da resposta
    setPosts((ps) =>
      ps.map((p) =>
        p.id === postId
          ? { ...p, likes: Math.max(0, p.likes + dLike), dislikes: Math.max(0, p.dislikes + dDislike) }
          : p,
      ),
    );
    setVotes((v) => {
      const nv = { ...v };
      if (next) nv[postId] = next;
      else delete nv[postId];
      localStorage.setItem(VOTES_KEY, JSON.stringify(nv));
      return nv;
    });

    const { data, error } = await createClient().rpc("react_post", {
      p_id: postId,
      d_like: dLike,
      d_dislike: dDislike,
    });
    // reconcilia com o valor real do servidor (corrige corridas/contagem)
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        const fresh = postFromRow(row as Record<string, unknown>);
        setPosts((ps) =>
          ps.map((p) => (p.id === postId ? { ...p, likes: fresh.likes, dislikes: fresh.dislikes } : p)),
        );
      }
    }
  }

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const { data } = await createClient()
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .lt("created_at", last.createdAt)
      .limit(pageSize);
    if (data) {
      setPosts((ps) => [...ps, ...data.map(postFromRow)]);
      if (data.length < pageSize) setHasMore(false);
    }
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">💬 Feed da Federação</h1>
        <p className="text-sm text-faint">Notícias e comunicados oficiais da Federação Rebug.</p>
      </div>

      {posts.length === 0 ? (
        <p className="text-center text-sm text-faint">Ainda não há publicações.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              now={now}
              vote={votes[p.id] ?? null}
              onReact={(kind) => react(p.id, kind)}
            />
          ))}
        </ul>
      )}

      {hasMore && posts.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-faint hover:bg-panel disabled:opacity-60"
          >
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
