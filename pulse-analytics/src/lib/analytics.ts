import { MOCK_DATA } from "./mock-data";

export type AnalyticsData = {
  summary: {
    totalPublished: number;
    avgQualityScore: number;
    activeStorylines: number;
    totalStorylines: number;
    totalSources: number;
    totalQuestions: number;
    totalViews: number;
    avgViewsPerArticle: number;
    articlesLast24h: number;
    lastPublished: string | null;
  };
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

/**
 * Try Supabase first. Falls back to mock data if credentials are
 * missing or the request fails — so the app always renders.
 */
export async function fetchAnalytics(): Promise<{ data: AnalyticsData; source: "live" | "mock" }> {
  const hasCredentials =
    !!import.meta.env.VITE_SUPABASE_URL &&
    !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (hasCredentials) {
    try {
      const data = await fetchLiveAnalytics();
      return { data, source: "live" };
    } catch (err) {
      console.warn("[Analytics] Supabase fetch failed, falling back to mock data.", err);
    }
  }

  await new Promise((r) => setTimeout(r, 500));
  return { data: MOCK_DATA, source: "mock" };
}

async function fetchLiveAnalytics(): Promise<AnalyticsData> {
  const { supabase } = await import("./supabase");

  const [
    { data: posts },
    { data: categories },
    { data: sources },
    { data: storylines },
    { data: candidates },
    { data: visits },
    { data: rags },
    { data: runs },
  ] = await Promise.all([
    supabase.from("posts").select("id, status, category_id, quality_score, published_at, created_at, source_name").eq("status", "published").order("published_at", { ascending: false }).limit(1000),
    supabase.from("categories").select("id, name, slug, color, gradient_from, gradient_to"),
    supabase.from("sources").select("id, name, category_id"),
    supabase.from("storylines").select("id, title, started_at, last_event_at"),
    supabase.from("candidates").select("status, discovered_at").gte("discovered_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("visits").select("post_id, day, count"),
    supabase.from("rag_questions").select("created_at").limit(1000),
    supabase.from("agent_runs").select("agent, status, started_at, finished_at").gte("started_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(1000),
  ]);

  const publishedPosts = posts ?? [];
  const allCategories = categories ?? [];
  const allSources = sources ?? [];
  const allStorylines = storylines ?? [];
  const allCandidates = candidates ?? [];
  const allVisits = visits ?? [];
  const allRags = rags ?? [];
  const allRuns = runs ?? [];

  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10);
  });

  const totalPublished = publishedPosts.length;
  const avgQualityScore = publishedPosts.length > 0 ? Math.round(publishedPosts.reduce((s, p) => s + (p.quality_score || 0), 0) / publishedPosts.length) : 0;
  const postsByCategory = allCategories.map((cat) => ({ name: cat.name, slug: cat.slug, count: publishedPosts.filter((p) => p.category_id === cat.id).length, color: cat.gradient_from }));
  const publishingVelocity = last30Days.map((day) => ({ day: day.slice(5), count: publishedPosts.filter((p) => p.published_at?.startsWith(day)).length }));
  const sourceStats = allSources.map((s) => ({ name: s.name, articles: publishedPosts.filter((p) => p.source_name === s.name).length, category: allCategories.find((c) => c.id === s.category_id)?.name || "Unknown" })).filter((s) => s.articles > 0).sort((a, b) => b.articles - a.articles);
  const activeStorylines = allStorylines.filter((s) => (Date.now() - new Date(s.last_event_at).getTime()) / 86400000 <= 30).length;
  const discovered = allCandidates.length;
  const scraped = allCandidates.filter((c) => ["scraped", "approved", "published"].includes(c.status)).length;
  const approved = allCandidates.filter((c) => ["approved", "published"].includes(c.status)).length;
  const candidatesPublished = allCandidates.filter((c) => c.status === "published").length;
  const successfulRuns = allRuns.filter((r) => r.status === "succeeded").length;
  const failedRuns = allRuns.filter((r) => r.status === "failed").length;
  const totalRuns = allRuns.length;
  const avgRunDuration = allRuns.filter((r) => r.finished_at).reduce((s, r) => s + (new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime()), 0) / (allRuns.filter((r) => r.finished_at).length || 1);
  const qualityBuckets = [{ range: "0-20", count: 0 }, { range: "21-40", count: 0 }, { range: "41-60", count: 0 }, { range: "61-80", count: 0 }, { range: "81-100", count: 0 }];
  publishedPosts.forEach((p) => { const s = p.quality_score || 0; if (s <= 20) qualityBuckets[0].count++; else if (s <= 40) qualityBuckets[1].count++; else if (s <= 60) qualityBuckets[2].count++; else if (s <= 80) qualityBuckets[3].count++; else qualityBuckets[4].count++; });
  const totalViews = allVisits.reduce((s, v) => s + v.count, 0);
  const viewsTrend = last30Days.map((day) => ({ day: day.slice(5), views: allVisits.filter((v) => v.day === day).reduce((s, v) => s + v.count, 0) }));
  const postViews = allVisits.reduce<Record<string, number>>((acc, v) => { acc[v.post_id] = (acc[v.post_id] || 0) + v.count; return acc; }, {});
  const mostViewedPosts = Object.entries(postViews).sort(([, a], [, b]) => b - a).slice(0, 10).map(([id, views]) => publishedPosts.find((p) => p.id === id) ? { id, views } : null).filter(Boolean);
  const totalQuestions = allRags.length;
  const questionsLast7Days = allRags.filter((q) => (Date.now() - new Date(q.created_at).getTime()) / 86400000 <= 7).length;
  const articlesLast24h = publishedPosts.filter((p) => p.published_at && (Date.now() - new Date(p.published_at).getTime()) / 3600000 <= 24).length;

  return {
    summary: { totalPublished, avgQualityScore, activeStorylines, totalStorylines: allStorylines.length, totalSources: allSources.length, totalQuestions, totalViews, avgViewsPerArticle: totalPublished > 0 ? Math.round(totalViews / totalPublished) : 0, articlesLast24h, lastPublished: publishedPosts[0]?.published_at || null },
    postsByCategory, publishingVelocity, sourceStats,
    discoveryFunnel: { discovered, scraped, approved, published: candidatesPublished, rejected: allCandidates.filter((c) => c.status === "rejected").length, duplicate: allCandidates.filter((c) => c.status === "duplicate").length, conversionRate: discovered > 0 ? ((candidatesPublished / discovered) * 100).toFixed(1) : "0" },
    agentPerformance: { totalRuns, successfulRuns, failedRuns, successRate: totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : "0", avgRunDurationSeconds: Math.round(avgRunDuration / 1000) },
    qualityDistribution: qualityBuckets,
    ragStats: { totalQuestions, questionsLast7Days },
    viewsTrend, mostViewedPosts,
  };
}
