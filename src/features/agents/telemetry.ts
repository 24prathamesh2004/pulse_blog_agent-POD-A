// Agent telemetry: Run tracking and tool call logging
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AgentName = "keyword" | "discovery" | "scraper" | "curator" | "editor" | "publisher";

export async function startRun(
  agent: AgentName,
  input: unknown,
  parentId?: string,
  categoryId?: string
) {
  const { data, error } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      agent,
      input: input as any,
      parent_run_id: parentId ?? null,
      category_id: categoryId ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function endRun(
  id: string,
  patch: {
    status: "succeeded" | "failed";
    output?: unknown;
    error?: string;
    tokens_in?: number;
    tokens_out?: number;
  }
) {
  await supabaseAdmin
    .from("agent_runs")
    .update({ ...patch, output: patch.output as any, finished_at: new Date().toISOString() })
    .eq("id", id);
}

export async function logTool(
  runId: string,
  tool: string,
  args: unknown,
  started: number,
  result?: unknown,
  error?: string
) {
  await supabaseAdmin.from("tool_calls").insert({
    run_id: runId,
    tool,
    args: args as any,
    result: result as any,
    error: error ?? null,
    latency_ms: Date.now() - started,
  });
}
