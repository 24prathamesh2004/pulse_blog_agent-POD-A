// Orchestrator: Coordinates the full agent pipeline for a category
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { startRun, endRun } from "./telemetry.js";
import { runKeywordAgent } from "./keyword.agent.js";
import { runDiscoveryAgent } from "./discovery.agent.js";
import { runScraperAgent } from "./scraper.agent.js";
import { runCuratorAgent } from "./curator.agent.js";
import { runEditorAgent } from "./editor.agent.js";

export async function runCategoryPipeline(categoryId: string) {
  const { data: cat } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .maybeSingle();

  if (!cat || !cat.enabled) return { skipped: true };
  if (cat.autonomy_mode === "off") return { skipped: true };

  const parentId = await startRun(
    "publisher",
    { categoryId, mode: cat.autonomy_mode },
    undefined,
    categoryId
  );

  try {
    // 1. Keyword discovery
    const kw = await runKeywordAgent({ categoryId, categoryName: cat.name }, parentId);

    // 2. Article discovery
    const found = await runDiscoveryAgent(
      { categoryId, keywords: kw.map((k) => k.term).slice(0, 8) },
      parentId
    );

    if (!found.length) {
      await endRun(parentId, { status: "succeeded", output: { note: "no candidates" } });
      return { created: 0 };
    }

    // 3. Scraping
    const { data: candRows } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("category_id", categoryId)
      .eq("status", "discovered")
      .limit(cat.max_per_run * 4);

    const ids = (candRows ?? []).map((r) => r.id);
    await runScraperAgent({ candidateIds: ids }, parentId);

    // 4. Curation
    const { data: scrapedRows } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("category_id", categoryId)
      .eq("status", "scraped")
      .limit(cat.max_per_run * 3);

    const scrapedIds = (scrapedRows ?? []).map((r) => r.id);
    const kept = await runCuratorAgent(
      { candidateIds: scrapedIds, threshold: cat.quality_threshold },
      parentId
    );

    console.log(
      `[Pipeline] Curator kept ${kept.length} of ${scrapedIds.length} candidates (threshold: ${cat.quality_threshold})`
    );

    if (kept.length === 0) {
      console.warn(
        `[Pipeline] No candidates passed quality check. Consider lowering quality_threshold (current: ${cat.quality_threshold})`
      );
      await endRun(parentId, {
        status: "succeeded",
        output: { note: "no candidates passed quality check", threshold: cat.quality_threshold },
      });
      return { created: 0 };
    }

    // 5. Editing & publishing
    const created = await runEditorAgent(
      {
        candidateIds: kept.slice(0, cat.max_per_run),
        categoryId,
        autoPublish: cat.autonomy_mode === "auto_publish",
      },
      parentId
    );

    await endRun(parentId, { status: "succeeded", output: { created: created.length } });
    return { created: created.length };
  } catch (e) {
    await endRun(parentId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
