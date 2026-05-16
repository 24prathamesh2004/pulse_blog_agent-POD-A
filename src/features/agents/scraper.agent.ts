// Scraper agent: Extracts article content using Mozilla Readability
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAndExtract } from "@/lib/tools.server";
import { startRun, endRun, logTool } from "./telemetry.js";

export async function runScraperAgent(args: { candidateIds: string[] }, parentId?: string) {
  const runId = await startRun("scraper", args, parentId);
  let ok = 0,
    fail = 0;

  try {
    for (const id of args.candidateIds) {
      const { data: c } = await supabaseAdmin.from("candidates").select("*").eq("id", id).maybeSingle();
      if (!c) continue;

      const t0 = Date.now();
      const ext = await fetchAndExtract(c.url);
      await logTool(
        runId,
        "fetch_extract",
        { url: c.url },
        t0,
        ext ? { title: ext.title, len: ext.text.length } : null,
        ext ? undefined : "no_content"
      );

      if (!ext || ext.text.length < 400) {
        await supabaseAdmin
          .from("candidates")
          .update({ status: "rejected", reason: (c.reason ?? "") + " | scrape:thin" })
          .eq("id", id);
        fail++;
        continue;
      }

      await supabaseAdmin
        .from("candidates")
        .update({
          status: "scraped",
          raw_text: ext.text.slice(0, 50000),
          raw_html: ext.html.slice(0, 200000),
          title: c.title || ext.title,
          hero_url: c.hero_url || ext.hero,
        })
        .eq("id", id);
      ok++;
    }

    await endRun(runId, { status: "succeeded", output: { ok, fail } });
    return { ok, fail };
  } catch (e) {
    await endRun(runId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
