// Keyword agent: Discovers trending terms using Google Trends + DuckDuckGo News
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { trendsRising, ddgNews } from "@/lib/tools.server";
import { startRun, endRun, logTool } from "./telemetry.js";

export async function runKeywordAgent(
  args: { categoryId: string; categoryName: string; seedHints?: string[] },
  parentId?: string
) {
  const runId = await startRun("keyword", args, parentId, args.categoryId);
  try {
    const seeds = args.seedHints?.length ? args.seedHints : [args.categoryName];
    const all: Array<{ term: string; score: number; trend: string }> = [];

    for (const seed of seeds.slice(0, 3)) {
      const t0 = Date.now();
      const trends = await trendsRising(seed);
      await logTool(runId, "google_trends", { seed }, t0, trends);
      for (const t of trends) all.push({ term: t.term, score: t.value, trend: "rising" });

      const t1 = Date.now();
      const news = await ddgNews(seed, 8);
      await logTool(runId, "ddg_news", { seed }, t1, news.slice(0, 3));
      for (const n of news) all.push({ term: n.title.slice(0, 80), score: 50, trend: "news" });
    }

    // Dedup + cap
    const dedup = new Map<string, { term: string; score: number; trend: string }>();
    for (const k of all) {
      const key = k.term.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, k);
    }
    const top = Array.from(dedup.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    if (top.length) {
      await supabaseAdmin.from("keywords").insert(
        top.map((k) => ({
          category_id: args.categoryId,
          term: k.term,
          score: k.score,
          trend_direction: k.trend,
        }))
      );
    }

    await endRun(runId, { status: "succeeded", output: { keywords: top } });
    return top;
  } catch (e) {
    await endRun(runId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
