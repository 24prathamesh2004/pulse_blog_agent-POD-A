import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCategoryPipeline } from "@/features/agents/orchestrator";
import { ragAnswer } from "@/features/rag/rag.service";
import { getLlmConfig, pingLlm, saveLlmConfig } from "./llm.server";

async function assertAdmin(supabase: any, userId: string) {
  // Use supabaseAdmin to bypass RLS and check admin role
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

// ─────────── public RAG ask
export const askArchive = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ question: z.string().min(2).max(500), postId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => ragAnswer(data));

// ─────────── admin: settings
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const llm = await getLlmConfig();
    const ping = await pingLlm();
    return { llm, ping: { ok: ping.ok, error: ping.error } };
  });

export const updateLlmSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    base_url: z.string().url().optional(),
    chat_model: z.string().min(1).optional(),
    embed_model: z.string().min(1).optional(),
    api_key: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return saveLlmConfig(data);
  });

// ─────────── admin: sources & categories
export const listAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: cats }, { data: sources }, { data: runs }, { data: posts }] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("sort_order"),
      supabaseAdmin.from("sources").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("agent_runs").select("id, agent, status, started_at, finished_at, tokens_in, tokens_out, error, category_id").order("started_at", { ascending: false }).limit(40),
      supabaseAdmin.from("posts").select("id, slug, title, subtitle, status, category_id, quality_score, published_at, created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    return { cats: cats ?? [], sources: sources ?? [], runs: runs ?? [], posts: posts ?? [] };
  });

export const upsertSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100), url: z.string().url(),
    type: z.enum(["rss", "web"]).default("rss"),
    category_id: z.string().uuid(),
    enabled: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id) {
      await supabaseAdmin.from("sources").update(data).eq("id", data.id);
    } else {
      await supabaseAdmin.from("sources").insert(data);
    }
    return { ok: true };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await supabaseAdmin.from("sources").delete().eq("id", data.id);
    return { ok: true };
  });

export const updateCategoryPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    autonomy_mode: z.enum(["off", "draft_only", "auto_publish"]).optional(),
    quality_threshold: z.number().min(0).max(100).optional(),
    max_per_run: z.number().min(1).max(20).optional(),
    enabled: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    await supabaseAdmin.from("categories").update(patch).eq("id", id);
    return { ok: true };
  });

// ─────────── admin: trigger pipeline
export const triggerCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ categoryId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return runCategoryPipeline(data.categoryId);
  });

// ─────────── admin: analytics
export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: posts } = await supabaseAdmin
      .from("posts").select("created_at, published_at, status, category_id, quality_score")
      .order("created_at", { ascending: false }).limit(500);
    const { data: runs } = await supabaseAdmin
      .from("agent_runs").select("agent, status, started_at, finished_at, tokens_in, tokens_out")
      .order("started_at", { ascending: false }).limit(200);
    const { data: rags } = await supabaseAdmin.from("rag_questions").select("created_at").limit(200);
    const { data: visits } = await supabaseAdmin.from("visits").select("day, count");
    return { posts: posts ?? [], runs: runs ?? [], rags: rags ?? [], visits: visits ?? [] };
  });

// expose pipeline for cron endpoint (without middleware)
export { runCategoryPipeline };
