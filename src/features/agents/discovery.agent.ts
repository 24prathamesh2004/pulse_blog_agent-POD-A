// Discovery agent: Finds fresh articles from RSS feeds + DuckDuckGo News
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchRss, ddgNews } from "@/lib/tools.server";
import { startRun, endRun, logTool } from "./telemetry.js";

export async function runDiscoveryAgent(
  args: { categoryId: string; keywords: string[] },
  parentId?: string
) {
  const runId = await startRun("discovery", args, parentId, args.categoryId);
  try {
    const found: Array<{ url: string; title: string; reason: string; source_id?: string }> = [];

    // RSS sources first
    const { data: sources } = await supabaseAdmin
      .from("sources")
      .select("id, url, name, type")
      .eq("enabled", true)
      .eq("category_id", args.categoryId);

    for (const s of sources ?? []) {
      if (s.type !== "rss") continue;
      const t0 = Date.now();
      const items = await fetchRss(s.url, 10);
      await logTool(runId, "rss", { url: s.url }, t0, items.slice(0, 3));
      for (const it of items)
        found.push({ url: it.url, title: it.title, reason: `RSS: ${s.name}`, source_id: s.id });
    }

    // Google News search for each keyword (via RSS)
    for (const kw of args.keywords.slice(0, 6)) {
      const t0 = Date.now();
      const news = await ddgNews(kw, 5); // Now uses Google News RSS internally
      await logTool(runId, "google_news", { kw }, t0, news.slice(0, 3));
      for (const n of news) {
        if (n.url && n.title) {
          found.push({ url: n.url, title: n.title, reason: `Keyword: ${kw}` });
        }
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

    // Dedup by URL
    const seen = new Set<string>();
    const unique = found.filter((f) => f.url && !seen.has(f.url) && (seen.add(f.url), true));

    // Filter against existing posts/candidates
    const urls = unique.map((u) => u.url);
    const { data: existing } = await supabaseAdmin.from("posts").select("source_url").in("source_url", urls);
    const { data: existingCands } = await supabaseAdmin.from("candidates").select("url").in("url", urls);
    const skip = new Set([
      ...(existing ?? []).map((e) => e.source_url),
      ...(existingCands ?? []).map((c) => c.url),
    ]);
    const fresh = unique.filter((u) => !skip.has(u.url));

    if (fresh.length) {
      await supabaseAdmin.from("candidates").insert(
        fresh.slice(0, 50).map((f) => ({
          category_id: args.categoryId,
          url: f.url,
          title: f.title,
          reason: f.reason,
          source_id: f.source_id ?? null,
          status: "discovered" as const,
        }))
      );
    }

    await endRun(runId, { status: "succeeded", output: { discovered: fresh.length } });
    return fresh;
  } catch (e) {
    await endRun(runId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
