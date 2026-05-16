import { createFileRoute } from "@tanstack/react-router";
import { listHomeFeed, listTickerItems } from "@/lib/posts.functions";
import { PulseTicker } from "@/components/pulse-ticker";
import { HeroCard, StoryCard, MicroStory, type PostCardData } from "@/components/post-cards";
import { AnalyticsWidget } from "@/components/analytics-widget";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [feed, ticker] = await Promise.all([listHomeFeed(), listTickerItems()]);
    return { feed, ticker };
  },
  component: Home,
});

function EmptyState() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-20">
      <div className="rounded-3xl border border-rule p-10 md:p-16 text-center bg-card">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-mono uppercase tracking-widest">
          <Sparkles className="h-3.5 w-3.5" /> The newsroom is warming up
        </div>
        <h1 className="display-xl text-5xl md:text-7xl mt-6 max-w-3xl mx-auto">
          No stories yet — tell the agents to start writing.
        </h1>
        <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
          Pulse is an autonomous, multi-agent blog. Open the Newsroom, configure your local model
          and sources, then trigger a run. The first stories will appear here within minutes.
        </p>
        <a href="/admin" className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90">
          Open the Newsroom
        </a>
      </div>
    </section>
  );
}

function Home() {
  const { feed, ticker } = Route.useLoaderData();
  if (!feed.hero) {
    return (
      <>
        <PulseTicker items={ticker} />
        <EmptyState />
      </>
    );
  }
  return (
    <>
      <PulseTicker items={ticker} />
      <section className="mx-auto max-w-[1400px] px-6 pt-8 md:pt-12 pb-16">
        <div className="grid grid-cols-12 gap-8">
          {/* Hero spans 8 cols */}
          <div className="col-span-12 lg:col-span-8">
            <HeroCard post={feed.hero} />
          </div>
          {/* Currents rail spans 4 cols */}
          <aside className="col-span-12 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <div className="meta mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Currents
            </div>
            <div>{feed.currents.map((p: PostCardData) => <MicroStory key={p.slug} post={p} />)}</div>
          </aside>
        </div>
      </section>

      {feed.featured.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-6 py-12 border-t border-rule">
          <div className="flex items-end justify-between mb-8">
            <h2 className="display-lg text-3xl md:text-4xl">Featured</h2>
            <span className="meta">Editor agent's picks</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {feed.featured.map((p: PostCardData) => <StoryCard key={p.slug} post={p} size="md" />)}
          </div>
        </section>
      )}

      {/* Analytics Widget */}
      <div className="mx-auto max-w-[1400px] px-6">
        <AnalyticsWidget />
      </div>

      {feed.grid.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-6 py-12 border-t border-rule">
          <div className="flex items-end justify-between mb-8">
            <h2 className="display-lg text-3xl md:text-4xl">The desk</h2>
            <span className="meta">Latest from every section</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {feed.grid.map((p: PostCardData) => <StoryCard key={p.slug} post={p} size="sm" />)}
          </div>
        </section>
      )}
    </>
  );
}
