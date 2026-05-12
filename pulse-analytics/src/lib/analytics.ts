import { MOCK_DATA } from "./mock-data";

export type AnalyticsData = {
  summary: { totalPublished: number; avgQualityScore: number; activeStorylines: number; totalStorylines: number; totalSources: number; totalQuestions: number; totalViews: number; avgViewsPerArticle: number; articlesLast24h: number; lastPublished: string | null };
  postsByCategory: { name: string; slug: string; count: number; color: string | null }[];
  publishingVelocity: { day: string; count: number }[];
  sourceStats: { name: string; articles: number; category: string }[];
  discoveryFunnel: { discovered: number; scraped: number; approved: number; published: number; rejected: number; duplicate: number; conversionRate: string };
  agentPerformance: { totalRuns: number; successfulRuns: number; failedRuns: number; successRate: string; avgRunDurationSeconds: number };
  qualityDistribution: { range: string; count: number }[];
  ragStats: { totalQuestions: number; questionsLast7Days: number };
  viewsTrend: { day: string; views: number }[];
  mostViewedPosts: ({ id: string; views: number } | null)[];
};

export async function fetchAnalytics(): Promise<{ data: AnalyticsData; source: "live" | "mock" }> {
  const hasCredentials = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (hasCredentials) {
    try { return { data: await fetchLive(), source: "live" }; }
    catch (e) { console.warn("[Analytics] Supabase failed, using mock data.", e); }
  }
  await new Promise((r) => setTimeout(r, 500));
  return { data: MOCK_DATA, source: "mock" };
}

async function fetchLive(): Promise<AnalyticsData> {
  const { supabase } = await import("./supabase");
  const [{ data: posts }, { data: categories }, { data: sources }, { data: storylines }, { data: candidates }, { data: visits }, { data: rags }, { data: runs }] = await Promise.all([
    supabase.from("posts").select("id,status,category_id,quality_score,published_at,created_at,source_name").eq("status", "published").order("published_at", { ascending: false }).limit(1000),
    supabase.from("categories").select("id,name,slug,color,gradient_from,gradient_to"),
    supabase.from("sources").select("id,name,category_id"),
    supabase.from("storylines").select("id,title,started_at,last_event_at"),
    supabase.from("candidates").select("status,discovered_at").gte("discovered_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("visits").select("post_id,day,count"),
    supabase.from("rag_questions").select("created_at").limit(1000),
    supabase.from("agent_runs").select("agent,status,started_at,finished_at").gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(1000),
  ]);
  const pp = posts ?? [], cats = categories ?? [], srcs = sources ?? [], stls = storylines ?? [], cands = candidates ?? [], vis = visits ?? [], rq = rags ?? [], ar = runs ?? [];
  const last30 = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10); });
  const totalViews = vis.reduce((s, v) => s + v.count, 0);
  const successfulRuns = ar.filter((r) => r.status === "succeeded").length;
  const failedRuns = ar.filter((r) => r.status === "failed").length;
  const totalRuns = ar.length;
  const avgDur = ar.filter((r) => r.finished_at).reduce((s, r) => s + (new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime()), 0) / (ar.filter((r) => r.finished_at).length || 1);
  const qb = [{ range: "0-20", count: 0 }, { range: "21-40", count: 0 }, { range: "41-60", count: 0 }, { range: "61-80", count: 0 }, { range: "81-100", count: 0 }];
  pp.forEach((p) => { const s = p.quality_score || 0; if (s <= 20) qb[0].count++; else if (s <= 40) qb[1].count++; else if (s <= 60) qb[2].count++; else if (s <= 80) qb[3].count++; else qb[4].count++; });
  const pv = vis.reduce<Record<string, number>>((a, v) => { a[v.post_id] = (a[v.post_id] || 0) + v.count; return a; }, {});
  const disc = cands.length, pub = cands.filter((c) => c.status === "published").length;
  return {
    summary: { totalPublished: pp.length, avgQualityScore: pp.length > 0 ? Math.round(pp.reduce((s, p) => s + (p.quality_score || 0), 0) / pp.length) : 0, activeStorylines: stls.filter((s) => (Date.now() - new Date(s.last_event_at).getTime()) / 86400000 <= 30).length, totalStorylines: stls.length, totalSources: srcs.length, totalQuestions: rq.length, totalViews, avgViewsPerArticle: pp.length > 0 ? Math.round(totalViews / pp.length) : 0, articlesLast24h: pp.filter((p) => p.published_at && (Date.now() - new Date(p.published_at).getTime()) / 3600000 <= 24).length, lastPublished: pp[0]?.published_at || null },
    postsByCategory: cats.map((c) => ({ name: c.name, slug: c.slug, count: pp.filter((p) => p.category_id === c.id).length, color: c.gradient_from })),
    publishingVelocity: last30.map((day) => ({ day: day.slice(5), count: pp.filter((p) => p.published_at?.startsWith(day)).length })),
    sourceStats: srcs.map((s) => ({ name: s.name, articles: pp.filter((p) => p.source_name === s.name).length, category: cats.find((c) => c.id === s.category_id)?.name || "Unknown" })).filter((s) => s.articles > 0).sort((a, b) => b.articles - a.articles),
    discoveryFunnel: { discovered: disc, scraped: cands.filter((c) => ["scraped", "approved", "published"].includes(c.status)).length, approved: cands.filter((c) => ["approved", "published"].includes(c.status)).length, published: pub, rejected: cands.filter((c) => c.status === "rejected").length, duplicate: cands.filter((c) => c.status === "duplicate").length, conversionRate: disc > 0 ? ((pub / disc) * 100).toFixed(1) : "0" },
    agentPerformance: { totalRuns, successfulRuns, failedRuns, successRate: totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : "0", avgRunDurationSeconds: Math.round(avgDur / 1000) },
    qualityDistribution: qb,
    ragStats: { totalQuestions: rq.length, questionsLast7Days: rq.filter((q) => (Date.now() - new Date(q.created_at).getTime()) / 86400000 <= 7).length },
    viewsTrend: last30.map((day) => ({ day: day.slice(5), views: vis.filter((v) => v.day === day).reduce((s, v) => s + v.count, 0) })),
    mostViewedPosts: Object.entries(pv).sort(([, a], [, b]) => b - a).slice(0, 10).map(([id, views]) => pp.find((p) => p.id === id) ? { id, views } : null).filter(Boolean),
  };
}
