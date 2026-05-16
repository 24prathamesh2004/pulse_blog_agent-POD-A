// Curator agent: Semantic deduplication + quality scoring using LLM
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embed, chatJSON } from "@/lib/llm.server";
import { startRun, endRun } from "./telemetry.js";

export async function runCuratorAgent(
  args: { candidateIds: string[]; threshold: number },
  parentId?: string
) {
  const runId = await startRun("curator", args, parentId);
  try {
    const kept: string[] = [];

    for (const id of args.candidateIds) {
      const { data: c } = await supabaseAdmin.from("candidates").select("*").eq("id", id).maybeSingle();
      if (!c?.raw_text) continue;

      // Embed and check vs existing posts
      const [vec] = await embed(c.title + "\n\n" + c.raw_text.slice(0, 2000));
      const { data: similar } = await supabaseAdmin.rpc("match_posts", {
        query_embedding: vec as any,
        match_count: 3,
        similarity_threshold: 0.85,
      });

      if (similar && similar.length > 0) {
        await supabaseAdmin
          .from("candidates")
          .update({ status: "rejected", reason: (c.reason ?? "") + " | dup" })
          .eq("id", id);
        continue;
      }

      // Quality scoring with LLM (1-100)
      const j = await chatJSON<{ score: number; reason: string }>(
        [
          {
            role: "system",
            content:
              'You are a strict news editor. Score this article from 1-100 for newsworthiness, factual density, and originality. Return JSON: {"score": number, "reason": string}.',
          },
          { role: "user", content: `Title: ${c.title}\n\n${c.raw_text.slice(0, 3000)}` },
        ],
        { retries: 3 } // ✅ Retry on failure
      ).catch(() => ({ data: { score: 60, reason: "fallback" }, tokens_in: 0, tokens_out: 0 }));

      if (j.data.score < args.threshold) {
        await supabaseAdmin
          .from("candidates")
          .update({ status: "rejected", reason: (c.reason ?? "") + ` | score:${j.data.score}` })
          .eq("id", id);
        continue;
      }

      await supabaseAdmin
        .from("candidates")
        .update({ status: "approved", reason: (c.reason ?? "") + ` | score:${j.data.score}` })
        .eq("id", id);
      kept.push(id);
    }

    await endRun(runId, { status: "succeeded", output: { kept: kept.length } });
    return kept;
  } catch (e) {
    await endRun(runId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
