// Local-first LLM client. Defaults to Ollama OpenAI-compatible API.
// Configurable at runtime via the `settings` table (key='llm').
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LlmConfig = {
  base_url: string; // e.g. http://localhost:11434/v1
  api_key: string; // Ollama ignores this; use "ollama"
  chat_model: string; // e.g. qwen2.5:7b
  embed_model: string; // e.g. nomic-embed-text  (768 dims)
  temperature: number;
};

const DEFAULTS: LlmConfig = {
  base_url: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  api_key: process.env.OLLAMA_API_KEY ?? "ollama",
  chat_model: process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b",
  embed_model: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
  temperature: 0.4,
};

export async function getLlmConfig(): Promise<LlmConfig> {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "llm").maybeSingle();
  const v = (data?.value ?? {}) as Partial<LlmConfig>;
  return { ...DEFAULTS, ...v };
}

export async function saveLlmConfig(cfg: Partial<LlmConfig>) {
  const merged = { ...(await getLlmConfig()), ...cfg };
  await supabaseAdmin.from("settings").upsert({ key: "llm", value: merged as any });
  return merged;
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMsg[], opts?: { json?: boolean; temperature?: number; retries?: number }) {
  const cfg = await getLlmConfig();
  const body: Record<string, unknown> = {
    model: cfg.chat_model,
    messages,
    temperature: opts?.temperature ?? cfg.temperature,
  };
  if (opts?.json) body.response_format = { type: "json_object" };

  const maxRetries = opts?.retries ?? 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${cfg.base_url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.api_key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000), // ✅ 5 minute timeout (was 120s)
      });
      if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text().catch(() => "")}`);
      const j = (await res.json()) as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return {
        content: j.choices?.[0]?.message?.content ?? "",
        tokens_in: j.usage?.prompt_tokens ?? 0,
        tokens_out: j.usage?.completion_tokens ?? 0,
      };
    } catch (e) {
      lastError = e as Error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff: 1s, 2s, 4s
        console.warn(`[LLM] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("LLM request failed");
}

export async function chatJSON<T = unknown>(messages: ChatMsg[], opts?: { retries?: number }): Promise<{ data: T; tokens_in: number; tokens_out: number }> {
  const out = await chat(messages, { json: true, temperature: 0.2, retries: opts?.retries });
  // Try strict parse, then fall back to substring extraction.
  const tryParse = (s: string): T | null => {
    try { return JSON.parse(s) as T; } catch { return null; }
  };
  let parsed = tryParse(out.content);
  if (!parsed) {
    const m = out.content.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!parsed) throw new Error("LLM did not return JSON");
  return { data: parsed, tokens_in: out.tokens_in, tokens_out: out.tokens_out };
}

export async function embed(input: string | string[], retries = 2): Promise<number[][]> {
  const cfg = await getLlmConfig();
  const arr = Array.isArray(input) ? input : [input];
  
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${cfg.base_url}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.api_key}` },
        body: JSON.stringify({ model: cfg.embed_model, input: arr }),
        signal: AbortSignal.timeout(180000), // ✅ 3 minute timeout for embeddings (was 60s)
      });
      if (!res.ok) throw new Error(`Embed ${res.status}: ${await res.text().catch(() => "")}`);
      const j = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return j.data.map((d) => d.embedding);
    } catch (e) {
      lastError = e as Error;
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[Embed] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("Embedding request failed");
}

export async function pingLlm(): Promise<{ ok: boolean; error?: string; cfg: LlmConfig }> {
  const cfg = await getLlmConfig();
  try {
    const res = await fetch(`${cfg.base_url}/models`, {
      headers: { Authorization: `Bearer ${cfg.api_key}` },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, cfg };
    return { ok: true, cfg };
  } catch (e) {
    return { ok: false, error: (e as Error).message, cfg };
  }
}
