// RAG (Retrieval-Augmented Generation): Answer questions using post embeddings
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embed, chat } from "@/lib/llm.server";

export async function ragAnswer(args: { question: string; postId?: string }) {
  const [qVec] = await embed(args.question);
  const { data: chunks } = await supabaseAdmin.rpc("match_post_chunks", {
    query_embedding: qVec as any,
    match_count: 8,
    filter_post_id: args.postId ?? undefined,
  });

  const ctx = (chunks ?? []).map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  const { data: postsForCite } = await supabaseAdmin
    .from("posts")
    .select("id, slug, title")
    .in(
      "id",
      Array.from(new Set((chunks ?? []).map((c) => c.post_id)))
    );

  const citations = (chunks ?? []).map((c, i) => {
    const p = postsForCite?.find((x) => x.id === c.post_id);
    return {
      n: i + 1,
      post_id: c.post_id,
      slug: p?.slug,
      title: p?.title,
      similarity: c.similarity,
    };
  });

  const ans = await chat([
    {
      role: "system",
      content:
        "You are Pulse Archivist. Answer ONLY using the numbered context. Cite sources inline like [1], [2]. If unsure, say so.",
    },
    { role: "user", content: `Question: ${args.question}\n\nContext:\n${ctx}` },
  ]);

  await supabaseAdmin.from("rag_questions").insert({
    question: args.question,
    answer: ans.content,
    citations: citations as any,
    post_id: args.postId ?? null,
  });

  return { answer: ans.content, citations };
}
