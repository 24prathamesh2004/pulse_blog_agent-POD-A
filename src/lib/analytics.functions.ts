import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public analytics - no auth required
export const getPublicAnalytics = createServerFn({ method: "GET" })
  .handler(async () => {
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
      // Posts data
      supabaseAdmin
        .from("posts")
        .select("id, status, category_id, quality_score, published_at, created_at, source_name")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1000),
      
      // Categories
      supabaseAdmin.from("categories").select("id, name, slug, color, gradient_from, gradient_to"),
      
      // Sources
      supabaseAdmin.from("sources").select("id, name, category_id"),
      
      // Storylines
      supabaseAdmin.from("storylines").select("id, title, started_at, last_event_at"),
      
      // Candidates for funnel
      supabaseAdmin
        .from("candidates")
        .select("status, discovered_at")
        .gte("discovered_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Visits
      supabaseAdmin.from("visits").select("post_id, day, count"),
      
      // RAG questions
      supabaseAdmin.from("rag_questions").select("created_at").limit(1000),
      
      // Agent runs (last 30 days for performance metrics)
      supabaseAdmin
        .from("agent_runs")
        .select("agent, status, started_at, finished_at")
        .gte("started_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000),
    ]);

    // Calculate metrics
    const publishedPosts = posts ?? [];
    const allCategories = categories ?? [];
    const allSources = sources ?? [];
    const allStorylines = storylines ?? [];
    const allCandidates = candidates ?? [];
    const allVisits = visits ?? [];
    const allRags = rags ?? [];
    const allRuns = runs ?? [];

    // 1. Content Production Metrics
    const totalPublished = publishedPosts.length;
    const postsByCategory = allCategories.map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      count: publishedPosts.filter((p) => p.category_id === cat.id).length,
      color: cat.gradient_from,
    }));

    const avgQualityScore = publishedPosts.length > 0
      ? Math.round(publishedPosts.reduce((sum, p) => sum + (p.quality_score || 0), 0) / publishedPosts.length)
      : 0;

    // Publishing velocity (last 30 days)
    const last30Days = Array.from({ length: 30 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().slice(0, 10);
    });

    const publishingVelocity = last30Days.map((day) => ({
      day: day.slice(5), // MM-DD
      count: publishedPosts.filter((p) => p.published_at?.startsWith(day)).length,
    }));

    // 2. Source Analytics
    const sourceStats = allSources.map((source) => {
      const sourcePosts = publishedPosts.filter((p) => p.source_name === source.name);
      return {
        name: source.name,
        articles: sourcePosts.length,
        category: allCategories.find((c) => c.id === source.category_id)?.name || "Unknown",
      };
    }).filter((s) => s.articles > 0).sort((a, b) => b.articles - a.articles);

    // 3. Storyline Analytics
    const activeStorylines = allStorylines.filter((s) => {
      const lastEvent = new Date(s.last_event_at);
      const daysSinceLastEvent = (Date.now() - lastEvent.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastEvent <= 30;
    }).length;

    const totalStorylines = allStorylines.length;

    // 4. Discovery Funnel
    const discovered = allCandidates.length;
    const scraped = allCandidates.filter((c) => ["scraped", "approved", "published"].includes(c.status)).length;
    const approved = allCandidates.filter((c) => ["approved", "published"].includes(c.status)).length;
    const candidatesPublished = allCandidates.filter((c) => c.status === "published").length;
    const rejected = allCandidates.filter((c) => c.status === "rejected").length;
    const duplicate = allCandidates.filter((c) => c.status === "duplicate").length;

    const conversionRate = discovered > 0 ? ((candidatesPublished / discovered) * 100).toFixed(1) : "0";

    // 5. Agent Performance
    const successfulRuns = allRuns.filter((r) => r.status === "succeeded").length;
    const failedRuns = allRuns.filter((r) => r.status === "failed").length;
    const totalRuns = allRuns.length;
    const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : "0";

    const avgRunDuration = allRuns
      .filter((r) => r.finished_at && r.started_at)
      .reduce((sum, r) => {
        const duration = new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime();
        return sum + duration;
      }, 0) / (allRuns.filter((r) => r.finished_at).length || 1);

    const avgRunDurationSeconds = Math.round(avgRunDuration / 1000);

    // Quality distribution
    const qualityBuckets = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];

    publishedPosts.forEach((p) => {
      const score = p.quality_score || 0;
      if (score <= 20) qualityBuckets[0].count++;
      else if (score <= 40) qualityBuckets[1].count++;
      else if (score <= 60) qualityBuckets[2].count++;
      else if (score <= 80) qualityBuckets[3].count++;
      else qualityBuckets[4].count++;
    });

    // 6. RAG Analytics
    const totalQuestions = allRags.length;
    const questionsLast7Days = allRags.filter((q) => {
      const created = new Date(q.created_at);
      const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length;

    // 7. Engagement Metrics
    const totalViews = allVisits.reduce((sum, v) => sum + v.count, 0);
    const avgViewsPerArticle = publishedPosts.length > 0 ? Math.round(totalViews / publishedPosts.length) : 0;

    // Views over time (last 30 days)
    const viewsTrend = last30Days.map((day) => ({
      day: day.slice(5),
      views: allVisits.filter((v) => v.day === day).reduce((sum, v) => sum + v.count, 0),
    }));

    // Most viewed posts
    const postViews = allVisits.reduce<Record<string, number>>((acc, v) => {
      acc[v.post_id] = (acc[v.post_id] || 0) + v.count;
      return acc;
    }, {});

    const mostViewedPosts = Object.entries(postViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([postId, views]) => {
        const post = publishedPosts.find((p) => p.id === postId);
        return post ? { id: post.id, views } : null;
      })
      .filter(Boolean);

    // 8. Real-time Status
    const lastPublished = publishedPosts[0]?.published_at || null;
    const articlesLast24h = publishedPosts.filter((p) => {
      if (!p.published_at) return false;
      const published = new Date(p.published_at);
      const hoursSince = (Date.now() - published.getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24;
    }).length;

    return {
      // Summary stats
      summary: {
        totalPublished,
        avgQualityScore,
        activeStorylines,
        totalStorylines,
        totalSources: allSources.length,
        totalQuestions,
        totalViews,
        avgViewsPerArticle,
        articlesLast24h,
        lastPublished,
      },
      // Charts data
      postsByCategory,
      publishingVelocity,
      sourceStats,
      discoveryFunnel: {
        discovered,
        scraped,
        approved,
        published: candidatesPublished,
        rejected,
        duplicate,
        conversionRate,
      },
      agentPerformance: {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate,
        avgRunDurationSeconds,
      },
      qualityDistribution: qualityBuckets,
      ragStats: {
        totalQuestions,
        questionsLast7Days,
      },
      viewsTrend,
      mostViewedPosts,
    };
  });
