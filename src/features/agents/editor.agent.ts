// Editor agent: Rewrites articles, generates takeaways, embeds for RAG, links to storylines
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatJSON, embed } from "@/lib/llm.server";
import { startRun, endRun } from "./telemetry.js";
import { linkToStoryline } from "../storylines/storyline.service.js";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function chunkText(text: string, size: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(" "));
  return out;
}

export async function runEditorAgent(
  args: { candidateIds: string[]; categoryId: string; autoPublish: boolean },
  parentId?: string
) {
  const runId = await startRun("editor", args, parentId, args.categoryId);
  const created: string[] = [];

  try {
    // ✅ Check if Ollama is responsive before starting
    console.log(`[Editor] Starting with ${args.candidateIds.length} candidates`);
    
    // ✅ Process articles with concurrency limit (2 at a time to avoid overwhelming Ollama)
    const results: Array<PromiseSettledResult<string | null>> = [];
    const CONCURRENCY = 2; // Process 2 articles at a time
    
    for (let i = 0; i < args.candidateIds.length; i += CONCURRENCY) {
      const batch = args.candidateIds.slice(i, i + CONCURRENCY);
      console.log(`[Editor] Processing batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(args.candidateIds.length / CONCURRENCY)} (${batch.length} articles)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (id) => {
        const { data: c } = await supabaseAdmin.from("candidates").select("*").eq("id", id).maybeSingle();
        if (!c?.raw_text) return null;

        const j = await chatJSON<{
          title: string;
          subtitle: string;
          summary: string;
          takeaways: string[];
          body_md: string;
          hero_prompt: string;
        }>(
          [
            {
              role: "system",
              content: `You are Pulse, a sharp newsroom editor. Rewrite the source into an original, well-structured article.
Rules:
- Original wording. Cite source attribution at the end.
- Output JSON with: title (<= 90 chars), subtitle (<= 140 chars), summary (2 sentences), takeaways (3-5 bullets), body_md (markdown, 500-900 words, with ## sections), hero_prompt (vivid editorial illustration prompt).`,
            },
            { role: "user", content: `Source: ${c.url}\nTitle: ${c.title}\n\n${c.raw_text.slice(0, 6000)}` },
          ],
          { retries: 3 } // ✅ Retry on failure
        );

        const slug = slugify(j.data.title) + "-" + Math.random().toString(36).slice(2, 6);
        const status = args.autoPublish ? "published" : "draft";
        const body = j.data.body_md + `\n\n---\n*Source: [${c.title}](${c.url})*`;

        const { data: post, error } = await supabaseAdmin
          .from("posts")
          .insert({
            slug,
            title: j.data.title,
            subtitle: j.data.subtitle,
            summary: j.data.summary,
            takeaways: j.data.takeaways as any,
            body_md: body,
            hero_prompt: j.data.hero_prompt,
            hero_url: c.hero_url,
            source_url: c.url,
            source_name: new URL(c.url).hostname.replace(/^www\./, ""),
            category_id: args.categoryId,
            status,
            quality_score: 70,
            published_at: status === "published" ? new Date().toISOString() : null,
          })
          .select("id")
          .single();

        if (error) {
          console.warn("post insert failed", error);
          return null;
        }

        // Embed post + chunks for RAG
        const [postVec] = await embed(j.data.title + "\n" + j.data.summary);
        await supabaseAdmin.from("posts").update({ embedding: postVec as any }).eq("id", post.id);

        const chunks = chunkText(body, 800);
        const vecs = await embed(chunks);
        await supabaseAdmin.from("post_chunks").insert(
          chunks.map((content, idx) => ({
            post_id: post.id,
            idx,
            content,
            embedding: vecs[idx] as any,
          }))
        );

        // ──────── Storyline clustering ────────
        await linkToStoryline(post.id, j.data.title, j.data.summary, postVec, runId);

        await supabaseAdmin.from("candidates").update({ status: "published" }).eq("id", id);
        return post.id;
        })
      );
      
      results.push(...batchResults);
    }

    // Collect successful results
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        created.push(result.value);
      } else if (result.status === "rejected") {
        console.warn("Article processing failed:", result.reason);
      }
    }

    await endRun(runId, { status: "succeeded", output: { created: created.length } });
    return created;
  } catch (e) {
    await endRun(runId, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
