import { createFileRoute } from "@tanstack/react-router";
import { AskPanel } from "@/components/ask-panel";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask the archive — Pulse" },
      { name: "description", content: "Chat with every story in the Pulse archive. Local AI + vector retrieval." },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-mono uppercase tracking-widest">
        <Sparkles className="h-3.5 w-3.5" /> RAG · Qwen2.5 · pgvector
      </div>
      <h1 className="display-xl text-5xl md:text-6xl mt-5">Ask the archive</h1>
      <p className="mt-4 text-muted-foreground max-w-xl">
        Pose questions across every published story. Answers stream from your local model with citations linking back to the original article.
      </p>
      <div className="mt-8">
        <AskPanel />
      </div>
    </section>
  );
}
