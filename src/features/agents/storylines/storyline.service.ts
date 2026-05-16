// Storyline clustering: Automatically groups related posts into ongoing narratives
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embed, chatJSON } from "@/lib/llm.server";
import { logTool } from "../agents/telemetry.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function linkToStoryline(
  postId: string,
  title: string,
  summary: string,
  embedding: number[],
  runId: string
) {
  const t0 = Date.now();

  // Get recent storylines (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: recentStorylines } = await supabaseAdmin
    .from("storylines")
    .select("id, title, summary, entity")
    .gte("last_event_at", thirtyDaysAgo.toISOString())
    .order("last_event_at", { ascending: false })
    .limit(50);

  if (!recentStorylines || recentStorylines.length === 0) {
    // No storylines exist, create first one
    await createNewStoryline(postId, title, summary, runId);
    return;
  }

  // Embed all storyline titles+summaries and compare
  const storylineTexts = recentStorylines.map((s) => `${s.title}\n${s.summary || ""}`);
  const storylineVecs = await embed(storylineTexts);

  // Calculate cosine similarity
  const similarities = storylineVecs.map((vec, idx) => ({
    id: recentStorylines[idx].id,
    title: recentStorylines[idx].title,
    similarity: cosineSimilarity(embedding, vec),
  }));

  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);
  const best = similarities[0];

  await logTool(runId, "storyline_match", { title, best_match: best.title, similarity: best.similarity }, t0);

  // If similarity > 0.75, link to existing storyline
  if (best.similarity > 0.75) {
    await supabaseAdmin.from("storyline_events").insert({
      storyline_id: best.id,
      post_id: postId,
      occurred_at: new Date().toISOString(),
    });
    // Update last_event_at
    await supabaseAdmin
      .from("storylines")
      .update({ last_event_at: new Date().toISOString() })
      .eq("id", best.id);

    // Update storyline summary with LLM (aggregate all events)
    await updateStorylineSummary(best.id);
  } else {
    // Create new storyline
    await createNewStoryline(postId, title, summary, runId);
  }
}

async function createNewStoryline(postId: string, title: string, summary: string, runId: string) {
  // Extract entity (person, company, country) using LLM
  const entityResult = await chatJSON<{ entity: string | null; storyline_title: string }>(
    [
      {
        role: "system",
        content: `Extract the main entity (person, company, country, or topic) and create a broader storyline title. Return JSON: {"entity": "EntityName or null", "storyline_title": "Broader narrative title"}`,
      },
      { role: "user", content: `Title: ${title}\nSummary: ${summary}` },
    ],
    { retries: 2 }
  ).catch(() => ({ data: { entity: null, storyline_title: title }, tokens_in: 0, tokens_out: 0 }));

  const { data: storyline } = await supabaseAdmin
    .from("storylines")
    .insert({
      title: entityResult.data.storyline_title,
      entity: entityResult.data.entity,
      summary: summary,
      started_at: new Date().toISOString(),
      last_event_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (storyline) {
    await supabaseAdmin.from("storyline_events").insert({
      storyline_id: storyline.id,
      post_id: postId,
      occurred_at: new Date().toISOString(),
    });
  }
}

async function updateStorylineSummary(storylineId: string) {
  // Get all posts in this storyline
  const { data: events } = await supabaseAdmin
    .from("storyline_events")
    .select("posts(title, summary)")
    .eq("storyline_id", storylineId)
    .order("occurred_at", { ascending: false })
    .limit(10);

  if (!events || events.length === 0) return;

  const posts = events
    .map((e) => e.posts as { title: string; summary: string | null })
    .filter((p) => p);
  const combined = posts.map((p) => `• ${p.title}: ${p.summary || ""}`).join("\n");

  const summaryResult = await chatJSON<{ summary: string }>(
    [
      {
        role: "system",
        content: `Synthesize these related news events into a 2-sentence storyline summary. Return JSON: {"summary": "..."}`,
      },
      { role: "user", content: combined },
    ],
    { retries: 2 }
  ).catch(() => ({ data: { summary: posts[0]?.summary || "" }, tokens_in: 0, tokens_out: 0 }));

  await supabaseAdmin
    .from("storylines")
    .update({ summary: summaryResult.data.summary })
    .eq("id", storylineId);
}
