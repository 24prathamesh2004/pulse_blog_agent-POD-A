import { createFileRoute } from "@tanstack/react-router";
import { runCategoryPipeline } from "@/features/agents/orchestrator";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public endpoint, secured by a shared secret. Called by pg_cron / external schedulers.
export const Route = createFileRoute("/api/public/agent-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-agent-secret") ?? new URL(request.url).searchParams.get("secret");
        if (!process.env.AGENT_TICK_SECRET || secret !== process.env.AGENT_TICK_SECRET) {
          return new Response("forbidden", { status: 403 });
        }
        const url = new URL(request.url);
        const onlyId = url.searchParams.get("categoryId");
        const { data: cats } = onlyId
          ? await supabaseAdmin.from("categories").select("id, name, autonomy_mode, enabled").eq("id", onlyId)
          : await supabaseAdmin.from("categories").select("id, name, autonomy_mode, enabled").eq("enabled", true).neq("autonomy_mode", "off");
        const results: Array<{ category: string; result: unknown; error?: string }> = [];
        for (const c of cats ?? []) {
          try {
            const r = await runCategoryPipeline(c.id);
            results.push({ category: c.name, result: r });
          } catch (e) {
            results.push({ category: c.name, result: null, error: (e as Error).message });
          }
        }
        return Response.json({ ran: results.length, results });
      },
      GET: async () => new Response("Use POST with x-agent-secret header.", { status: 200 }),
    },
  },
});
