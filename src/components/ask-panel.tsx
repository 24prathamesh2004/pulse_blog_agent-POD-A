import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askArchive } from "@/lib/admin.functions";
import { Sparkles, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";

type Citation = { n: number; post_id: string; slug?: string; title?: string; similarity: number };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export function AskPanel({ postId, placeholder = "Ask about the archive…" }: { postId?: string; placeholder?: string }) {
  const ask = useServerFn(askArchive);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    const question = q.trim();
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await ask({ data: { question, postId } });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, citations: r.citations }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${(err as Error).message}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-rule bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-rule flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-display text-sm font-semibold">{postId ? "Ask this article" : "Ask the archive"}</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-5 space-y-4">
        {msgs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {postId ? "Ask any question about this article." : "Ask anything; answers cite the original stories."}
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-sm font-medium" : "text-sm prose-pulse"}>
            {m.role === "user" ? <span className="text-muted-foreground">You: </span> : null}
            {m.role === "assistant"
              ? <ReactMarkdown>{m.content}</ReactMarkdown>
              : <span>{m.content}</span>}
            {m.citations?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.citations.slice(0, 6).map((c) => (
                  <Link key={c.n} to="/post/$slug" params={{ slug: c.slug ?? "" }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-rule hover:bg-muted">
                    [{c.n}] {c.title?.slice(0, 60) ?? c.slug}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-rule p-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-transparent text-sm px-2 py-2 outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={busy} className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
