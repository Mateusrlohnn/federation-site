import type { Metadata } from "next";
import FeedClient from "@/components/feed/FeedClient";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { postFromRow, type Post } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed — Federação Rebug",
  description: "O mural da Federação: notícias oficiais e a voz da torcida.",
};

const PAGE = 30;

async function getPosts(): Promise<Post[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (error || !data) return [];
    return data.map(postFromRow);
  } catch {
    return [];
  }
}

export default async function FeedPage() {
  const posts = await getPosts();
  return <FeedClient initialPosts={posts} pageSize={PAGE} />;
}
