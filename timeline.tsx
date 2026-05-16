import { createFileRoute, Link } from "@tanstack/react-router";
import { listTimeline } from "@/lib/posts.functions";
import { categoryAccent, formatRelativeDate } from "@/lib/categories";

export const Route = createFileRoute("/timeline")({
  head: () => ({ meta: [{ title: "Storyline timeline — Pulse" }, { name: "description", content: "Stories clustered into ongoing storylines, plotted along a timeline." }] }),
  loader: () => listTimeline(),
  component: Timeline,
});

function Timeline() {
  const storylines = Route.useLoaderData();
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-12">
      <h1 className="display-xl text-5xl md:text-6xl mb-3">Timeline</h1>
      <p className="text-muted-foreground mb-12 max-w-xl">Ongoing storylines, automatically clustered by the curator agent.</p>
      {storylines.length === 0 ? (
        <p className="text-muted-foreground">No storylines yet — they appear once the agents publish related stories.</p>
      ) : (
        <div className="space-y-12">
          {(storylines as Array<{ id: string; title: string; summary: string | null; last_event_at: string; events: Array<{ slug: string; title: string; occurred_at: string; category_slug: string | null }> }>).map((s) => (
            <div key={s.id}>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="display-lg text-2xl md:text-3xl">{s.title}</h2>
                <span className="meta">last update {formatRelativeDate(s.last_event_at)}</span>
              </div>
              {s.summary && <p className="text-muted-foreground mb-6 max-w-2xl">{s.summary}</p>}
              <ol className="relative border-l-2 border-rule ml-2 space-y-6">
                {s.events.map((e) => (
                  <li key={e.slug} className="pl-6 relative">
                    <span
                      className="absolute -left-[7px] top-2 h-3 w-3 rounded-full ring-4 ring-background"
                      style={{ background: categoryAccent(e.category_slug) }}
                    />
                    <div className="meta mb-1">{formatRelativeDate(e.occurred_at)}</div>
                    <Link to="/post/$slug" params={{ slug: e.slug }} className="font-display text-lg hover:text-primary">
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
