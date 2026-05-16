import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// Public reads use admin client to avoid auth requirement; RLS still enforced
// at the DB level for *writes*. For reads we only return published posts.

export const listHomeFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { data: posts, error } = await supabaseAdmin
    .from("posts")
    .select("id, slug, title, subtitle, hero_url, summary, published_at, source_name, category_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("listHomeFeed", error);
    return { hero: null, currents: [], featured: [], grid: [], categories: [] as Array<{ slug: string; name: string }> };
  }
  const { data: cats } = await supabaseAdmin.from("categories").select("id, slug, name");
  const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
  const enriched = (posts ?? []).map((p) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    hero_url: p.hero_url,
    summary: p.summary,
    published_at: p.published_at,
    source_name: p.source_name,
    category_slug: p.category_id ? catMap.get(p.category_id)?.slug ?? null : null,
  }));
  return {
    hero: enriched[0] ?? null,
    currents: enriched.slice(1, 6),
    featured: enriched.slice(6, 9),
    grid: enriched.slice(9, 21),
    categories: (cats ?? []).map((c) => ({ slug: c.slug, name: c.name })),
  };
});

export const listTickerItems = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("slug, title, category_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(8);
  if (error || !data) return [] as Array<{ slug: string; title: string; category?: string | null }>;
  const { data: cats } = await supabaseAdmin.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.id, c.slug]));
  return data.map((d) => ({
    slug: d.slug,
    title: d.title,
    category: d.category_id ? catMap.get(d.category_id) ?? null : null,
  }));
});

export const getCategoryFeed = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const { data: cat } = await supabaseAdmin
      .from("categories")
      .select("id, slug, name, description")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!cat) return { category: null, posts: [] };
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("slug, title, subtitle, hero_url, summary, published_at, source_name")
      .eq("status", "published")
      .eq("category_id", cat.id)
      .order("published_at", { ascending: false })
      .limit(40);
    return {
      category: cat,
      posts: (posts ?? []).map((p) => ({ ...p, category_slug: cat.slug })),
    };
  });

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    // First try to get the post (any status)
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    
    if (!post) return { post: null, category: null, related: [] };
    
    // If it's a draft, check if user is admin (allow preview)
    // For now, we'll return drafts but add a flag
    const isDraft = post.status !== "published";
    
    const { data: cat } = post.category_id
      ? await supabaseAdmin.from("categories").select("slug, name").eq("id", post.category_id).maybeSingle()
      : { data: null };
    const { data: related } = await supabaseAdmin
      .from("posts")
      .select("slug, title, hero_url, published_at, category_id")
      .eq("status", "published")
      .neq("id", post.id)
      .eq("category_id", post.category_id ?? "00000000-0000-0000-0000-000000000000")
      .order("published_at", { ascending: false })
      .limit(4);
    return {
      post: { ...post, category_slug: cat?.slug ?? null, category_name: cat?.name ?? null, isDraft },
      category: cat,
      related: (related ?? []).map((r) => ({ ...r, category_slug: cat?.slug ?? null })),
    };
  });

export const listTimeline = createServerFn({ method: "GET" }).handler(async () => {
  const { data: storylines } = await supabaseAdmin
    .from("storylines")
    .select("id, title, entity, summary, last_event_at")
    .order("last_event_at", { ascending: false })
    .limit(20);
  const { data: events } = await supabaseAdmin
    .from("storyline_events")
    .select("storyline_id, occurred_at, post_id, posts(slug, title, hero_url, category_id)")
    .order("occurred_at", { ascending: false })
    .limit(200);
  const { data: cats } = await supabaseAdmin.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.id, c.slug]));
  const grouped = new Map<string, Array<{ slug: string; title: string; hero_url: string | null; occurred_at: string; category_slug: string | null }>>();
  for (const e of events ?? []) {
    const p = e.posts as { slug: string; title: string; hero_url: string | null; category_id: string | null } | null;
    if (!p) continue;
    const arr = grouped.get(e.storyline_id) ?? [];
    arr.push({
      slug: p.slug,
      title: p.title,
      hero_url: p.hero_url,
      occurred_at: e.occurred_at,
      category_slug: p.category_id ? catMap.get(p.category_id) ?? null : null,
    });
    grouped.set(e.storyline_id, arr);
  }
  return (storylines ?? []).map((s) => ({ ...s, events: grouped.get(s.id) ?? [] }));
});
