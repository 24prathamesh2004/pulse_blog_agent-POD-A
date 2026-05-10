import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthServerFn } from "@/lib/use-auth-server-fn";
import {
  getSettings, updateLlmSettings, listAdminData, upsertSource, deleteSource,
  updateCategoryPolicy, triggerCategory, getAnalytics,
} from "@/lib/admin.functions";
import {
  Activity, Settings, Rss, Sparkles, BarChart3, Play, Trash2, CheckCircle2, XCircle, Loader2, LogOut,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Newsroom — Pulse" }] }),
  component: AdminPage,
});

type Tab = "overview" | "agents" | "sources" | "settings" | "posts";

function AdminPage() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === false) {
    return (
      <section className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="display-lg text-3xl">Newsroom</h1>
        <p className="mt-3 text-muted-foreground">Sign in to manage agents, sources, and analytics.</p>
        <Link to="/login" className="mt-6 inline-block rounded-full bg-foreground text-background px-5 py-2.5 font-medium">Sign in</Link>
      </section>
    );
  }
  if (authed === null) return <div className="p-20 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></div>;

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="meta">Newsroom dashboard</div>
          <h1 className="display-lg text-3xl mt-1">Pulse control room</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}
            className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-sm hover:bg-muted">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 mb-8 border-b border-rule">
        {([
          ["overview", Activity, "Overview"],
          ["posts", BarChart3, "Posts & Drafts"],
          ["agents", Sparkles, "Agents & runs"],
          ["sources", Rss, "Sources & policy"],
          ["settings", Settings, "Local AI settings"],
        ] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "agents" && <AgentsTab />}
      {tab === "sources" && <SourcesTab />}
      {tab === "settings" && <SettingsTab />}
    </section>
  );
}

// ─────────── Overview / Analytics
function OverviewTab() {
  const fn = useAuthServerFn(getAnalytics);
  const [d, setD] = useState<Awaited<ReturnType<typeof fn>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => { 
    fn()
      .then(setD)
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load analytics');
      }); 
  }, [fn]);
  
  if (error) {
    return (
      <div className="rounded-2xl border border-rule bg-card p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Database Not Set Up</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The database tables haven't been created yet. Please run the migrations first.
        </p>
        <p className="text-xs text-muted-foreground">
          See DATABASE_SETUP.md for instructions
        </p>
      </div>
    );
  }
  
  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;

  const byDay = Array.from({ length: 14 }).map((_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (13 - i));
    const key = day.toISOString().slice(0, 10);
    const published = (d.posts || []).filter((p) => p.published_at?.startsWith(key)).length;
    const runs = (d.runs || []).filter((r) => r.started_at.startsWith(key)).length;
    return { day: key.slice(5), published, runs };
  });
  const tokensByAgent = Object.values(
    (d.runs || []).reduce<Record<string, { agent: string; tokens: number }>>((acc, r) => {
      const k = r.agent;
      acc[k] = acc[k] ?? { agent: k, tokens: 0 };
      acc[k].tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
      return acc;
    }, {})
  );
  const ok = (d.runs || []).filter((r) => r.status === "succeeded").length;
  const fail = (d.runs || []).filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Published" value={(d.posts || []).filter((p) => p.status === "published").length} />
        <Stat label="Drafts" value={(d.posts || []).filter((p) => p.status === "draft").length} />
        <Stat label="Agent runs (success)" value={ok} sub={`${fail} failed`} />
        <Stat label="RAG questions" value={(d.rags || []).length} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Published & runs · last 14 days">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="published" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="runs" stroke="var(--cat-ai-from)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Token usage by agent">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={tokensByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="agent" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 12 }} />
                <Bar dataKey="tokens" fill="var(--cat-markets-from)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────── Posts & Drafts
function PostsTab() {
  const list = useAuthServerFn(listAdminData);
  const [d, setD] = useState<Awaited<ReturnType<typeof list>> | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("draft");

  async function refresh() { setD(await list()); }
  useEffect(() => { refresh().catch(console.error); /* eslint-disable-next-line */ }, []);

  async function updateStatus(id: string, status: "published" | "draft" | "archived") {
    try {
      await supabase.from("posts").update({ 
        status,
        published_at: status === "published" ? new Date().toISOString() : null 
      }).eq("id", id);
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    try {
      await supabase.from("posts").delete().eq("id", id);
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;

  const posts = d.posts || [];
  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);
  const drafts = posts.filter(p => p.status === "draft");
  const published = posts.filter(p => p.status === "published");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === "all" ? "bg-foreground text-background" : "bg-muted"}`}>
            All ({posts.length})
          </button>
          <button onClick={() => setFilter("draft")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === "draft" ? "bg-foreground text-background" : "bg-muted"}`}>
            Drafts ({drafts.length})
          </button>
          <button onClick={() => setFilter("published")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === "published" ? "bg-foreground text-background" : "bg-muted"}`}>
            Published ({published.length})
          </button>
        </div>
      </div>

      <Card title={`${filter === "all" ? "All posts" : filter === "draft" ? "Draft posts" : "Published posts"} (${filtered.length})`}>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No {filter === "all" ? "posts" : filter} yet. Run an agent to generate content.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div key={p.id} className="border border-rule rounded-xl p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to="/post/$slug" params={{ slug: p.slug }} className="font-display font-semibold text-lg hover:text-primary truncate">
                        {p.title}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "published" ? "bg-emerald-500/20 text-emerald-500" :
                        p.status === "draft" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    {p.subtitle && <p className="text-sm text-muted-foreground mb-2">{p.subtitle}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{d.cats.find(c => c.id === p.category_id)?.name || "Uncategorized"}</span>
                      <span>•</span>
                      <span>Score: {p.quality_score}</span>
                      {p.published_at && (
                        <>
                          <span>•</span>
                          <span>{new Date(p.published_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === "draft" && (
                      <button onClick={() => updateStatus(p.id, "published")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600">
                        Publish
                      </button>
                    )}
                    {p.status === "published" && (
                      <button onClick={() => updateStatus(p.id, "draft")}
                        className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80">
                        Unpublish
                      </button>
                    )}
                    <button onClick={() => deletePost(p.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────── Agents & runs
function AgentsTab() {
  const list = useAuthServerFn(listAdminData);
  const trigger = useAuthServerFn(triggerCategory);
  const [d, setD] = useState<Awaited<ReturnType<typeof list>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() { setD(await list()); }
  useEffect(() => { refresh().catch(console.error); /* eslint-disable-next-line */ }, []);

  async function run(id: string) {
    setBusy(id);
    try { await trigger({ data: { categoryId: id } }); await refresh(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }

  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-8">
      <Card title="Run a category pipeline">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {d.cats.map((c) => (
            <div key={c.id} className="rounded-xl border border-rule p-4 flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">{c.name}</div>
                <div className="meta mt-0.5">{c.autonomy_mode.replace("_", " ")} · q≥{c.quality_threshold}</div>
              </div>
              <button disabled={busy === c.id} onClick={() => run(c.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-medium px-3 py-1.5 disabled:opacity-50">
                {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Recent agent runs (${d.runs.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left meta border-b border-rule">
              <th className="py-2">Agent</th><th>Status</th><th>Started</th><th>Duration</th><th>Tokens</th><th>Error</th>
            </tr></thead>
            <tbody>
              {d.runs.map((r) => {
                const dur = r.finished_at ? Math.round((+new Date(r.finished_at) - +new Date(r.started_at))) : null;
                return (
                  <tr key={r.id} className="border-b border-rule/50">
                    <td className="py-2 font-mono">{r.agent}</td>
                    <td>{r.status === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                      : r.status === "failed" ? <XCircle className="h-4 w-4 text-red-500 inline" />
                      : <Loader2 className="h-4 w-4 animate-spin inline" />}</td>
                    <td className="meta">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="meta">{dur != null ? `${(dur / 1000).toFixed(1)}s` : "—"}</td>
                    <td className="meta">{(r.tokens_in ?? 0) + (r.tokens_out ?? 0)}</td>
                    <td className="text-red-500 text-xs max-w-[300px] truncate" title={r.error ?? ""}>{r.error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────── Sources & category policy
function SourcesTab() {
  const list = useAuthServerFn(listAdminData);
  const upsert = useAuthServerFn(upsertSource); const remove = useAuthServerFn(deleteSource);
  const upd = useAuthServerFn(updateCategoryPolicy);
  const [d, setD] = useState<Awaited<ReturnType<typeof list>> | null>(null);
  const [form, setForm] = useState({ name: "", url: "", category_id: "", type: "rss" as "rss" | "web" });

  async function refresh() { setD(await list()); }
  useEffect(() => { refresh().catch(console.error); /* eslint-disable-next-line */ }, []);
  if (!d) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-8">
      <Card title="Category autonomy policies">
        <div className="space-y-2">
          {d.cats.map((c) => (
            <div key={c.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center rounded-xl border border-rule p-3">
              <div className="font-display font-semibold">{c.name}</div>
              <select defaultValue={c.autonomy_mode}
                onChange={(e) => upd({ data: { id: c.id, autonomy_mode: e.target.value as any } })}
                className="rounded-lg border border-rule bg-background px-3 py-2 text-sm">
                <option value="off">off</option>
                <option value="draft_only">draft_only (human approve)</option>
                <option value="auto_publish">auto_publish</option>
              </select>
              <label className="text-sm flex items-center gap-2">quality ≥
                <input type="number" min={0} max={100} defaultValue={c.quality_threshold}
                  onBlur={(e) => upd({ data: { id: c.id, quality_threshold: +e.target.value } })}
                  className="w-16 rounded-lg border border-rule bg-background px-2 py-1 text-sm" /></label>
              <label className="text-sm flex items-center gap-2">max/run
                <input type="number" min={1} max={20} defaultValue={c.max_per_run}
                  onBlur={(e) => upd({ data: { id: c.id, max_per_run: +e.target.value } })}
                  className="w-16 rounded-lg border border-rule bg-background px-2 py-1 text-sm" /></label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" defaultChecked={c.enabled}
                  onChange={(e) => upd({ data: { id: c.id, enabled: e.target.checked } })} /> enabled
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Sources">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!form.name || !form.url || !form.category_id) return;
          await upsert({ data: { ...form, enabled: true } });
          setForm({ name: "", url: "", category_id: "", type: "rss" }); await refresh();
        }} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-rule bg-background px-3 py-2 text-sm md:col-span-1" />
          <input placeholder="https://… (RSS)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="rounded-lg border border-rule bg-background px-3 py-2 text-sm md:col-span-2" />
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="rounded-lg border border-rule bg-background px-3 py-2 text-sm">
            <option value="">Category…</option>
            {d.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-2">Add source</button>
        </form>
        <div className="space-y-1">
          {d.sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-rule/60 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="meta truncate">{s.url}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="meta">{d.cats.find((c) => c.id === s.category_id)?.name ?? "—"}</span>
                <button onClick={async () => { await remove({ data: { id: s.id } }); await refresh(); }}
                  className="text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {!d.sources.length && <p className="text-sm text-muted-foreground">No sources yet — agents will rely on keyword/news search until you add some RSS feeds.</p>}
        </div>
      </Card>
    </div>
  );
}

// ─────────── Local AI settings
function SettingsTab() {
  const get = useAuthServerFn(getSettings); const upd = useAuthServerFn(updateLlmSettings);
  const [s, setS] = useState<Awaited<ReturnType<typeof get>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => { 
    get()
      .then(setS)
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load settings');
      }); 
  }, [get]);
  
  if (error) {
    return (
      <div className="rounded-2xl border border-rule bg-card p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-sm text-muted-foreground">
          You need to be logged in as an admin to access settings.
        </p>
      </div>
    );
  }
  
  if (!s) return <Loader2 className="h-5 w-5 animate-spin" />;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await upd({ data: {
        base_url: String(fd.get("base_url") || ""),
        chat_model: String(fd.get("chat_model") || ""),
        embed_model: String(fd.get("embed_model") || ""),
        api_key: String(fd.get("api_key") || ""),
        temperature: Number(fd.get("temperature") || 0.4),
      } });
      let ping: { ok: boolean; error: string | undefined };
      try {
        const r = await fetch(`${updated.base_url}/models`, { headers: { Authorization: `Bearer ${updated.api_key}` } });
        ping = { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
      } catch (err) { ping = { ok: false, error: (err as Error).message }; }
      setS({ ...s, llm: updated, ping });
    } finally { setSaving(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="Local AI runtime">
        <div className="text-sm mb-4 flex items-center gap-2">
          {s.ping?.ok ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Connected to {s.llm.base_url}</>
            : <><XCircle className="h-4 w-4 text-red-500" /> Not reachable: <span className="meta">{s.ping?.error}</span></>}
        </div>
        <form onSubmit={save} className="space-y-3">
          <Field name="base_url" label="OpenAI-compatible base URL" def={s.llm.base_url} placeholder="http://localhost:11434/v1" />
          <Field name="api_key" label="API key (Ollama: 'ollama')" def={s.llm.api_key} />
          <Field name="chat_model" label="Chat model" def={s.llm.chat_model} placeholder="qwen2.5:7b" />
          <Field name="embed_model" label="Embedding model (768 dims)" def={s.llm.embed_model} placeholder="nomic-embed-text" />
          <Field name="temperature" label="Temperature" def={String(s.llm.temperature)} type="number" />
          <button disabled={saving} className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </Card>
      <Card title="Architecture">
        <ul className="text-sm space-y-2 text-muted-foreground">
          <li>• <b className="text-foreground">Keyword agent</b>: DuckDuckGo news + Google Trends → fresh terms.</li>
          <li>• <b className="text-foreground">Discovery agent</b>: RSS feeds + targeted news search.</li>
          <li>• <b className="text-foreground">Scraper agent</b>: Mozilla Readability + cheerio.</li>
          <li>• <b className="text-foreground">Curator agent</b>: pgvector dedupe + LLM quality scoring.</li>
          <li>• <b className="text-foreground">Editor agent</b>: rewrites article (Qwen2.5), produces takeaways + hero prompt, embeds for RAG.</li>
          <li>• <b className="text-foreground">RAG</b>: <code>pgvector</code> chunk retrieval + cited answers.</li>
        </ul>
      </Card>
    </div>
  );
}

// ─────────── small UI primitives
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <div className="meta mb-4">{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <div className="meta">{label}</div>
      <div className="mt-1 font-display text-3xl">{value}</div>
      {sub && <div className="meta mt-1">{sub}</div>}
    </div>
  );
}
function Field({ name, label, def, placeholder, type = "text" }: { name: string; label: string; def: string; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <div className="meta mb-1">{label}</div>
      <input name={name} defaultValue={def} placeholder={placeholder} type={type}
        className="w-full rounded-lg border border-rule bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}
