import type { AnalyticsData } from "./analytics";

function last30DayLabels() {
  return Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(5, 10);
  });
}

const days = last30DayLabels();

export const MOCK_DATA: AnalyticsData = {
  summary: {
    totalPublished: 347,
    avgQualityScore: 82,
    activeStorylines: 14,
    totalStorylines: 38,
    totalSources: 22,
    totalQuestions: 193,
    totalViews: 48_210,
    avgViewsPerArticle: 139,
    articlesLast24h: 6,
    lastPublished: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
  },
  postsByCategory: [
    { name: "AI", slug: "ai", count: 98, color: "oklch(0.55 0.24 295)" },
    { name: "Climate", slug: "climate", count: 61, color: "oklch(0.45 0.16 155)" },
    { name: "Markets", slug: "markets", count: 54, color: "oklch(0.25 0.04 270)" },
    { name: "Geopolitics", slug: "geopolitics", count: 72, color: "oklch(0.4 0.18 25)" },
    { name: "Science", slug: "science", count: 43, color: "oklch(0.5 0.16 215)" },
    { name: "Culture", slug: "culture", count: 19, color: "oklch(0.55 0.22 350)" },
  ],
  publishingVelocity: days.map((day, i) => ({
    day,
    count: Math.max(0, Math.round(8 + Math.sin(i * 0.6) * 4 + (Math.random() * 3 - 1.5))),
  })),
  sourceStats: [
    { name: "Reuters", articles: 54, category: "Markets" },
    { name: "MIT Tech Review", articles: 47, category: "AI" },
    { name: "The Guardian", articles: 38, category: "Climate" },
    { name: "Ars Technica", articles: 35, category: "AI" },
    { name: "BBC News", articles: 31, category: "Geopolitics" },
    { name: "Nature", articles: 28, category: "Science" },
    { name: "Bloomberg", articles: 24, category: "Markets" },
    { name: "Wired", articles: 21, category: "AI" },
    { name: "Al Jazeera", articles: 18, category: "Geopolitics" },
    { name: "New Scientist", articles: 15, category: "Science" },
  ],
  discoveryFunnel: {
    discovered: 2840,
    scraped: 2190,
    approved: 891,
    published: 347,
    rejected: 1299,
    duplicate: 544,
    conversionRate: "12.2",
  },
  agentPerformance: {
    totalRuns: 1024,
    successfulRuns: 978,
    failedRuns: 46,
    successRate: "95.5",
    avgRunDurationSeconds: 38,
  },
  qualityDistribution: [
    { range: "0-20", count: 2 },
    { range: "21-40", count: 8 },
    { range: "41-60", count: 31 },
    { range: "61-80", count: 142 },
    { range: "81-100", count: 164 },
  ],
  ragStats: { totalQuestions: 193, questionsLast7Days: 41 },
  viewsTrend: days.map((day, i) => ({
    day,
    views: Math.max(0, Math.round(1400 + Math.sin(i * 0.4) * 600 + (Math.random() * 300 - 150))),
  })),
  mostViewedPosts: [
    { id: "1", views: 3812 },
    { id: "2", views: 2940 },
    { id: "3", views: 2105 },
  ],
};
